"""Cuentas y sesiones (RF-01): contraseña, Google, registro, verificación y recuperación."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.adapters.email import EmailMessage, EmailSender
from app.core.config import settings
from app.core.database import after_commit
from app.core.errors import Conflict, DomainError, Forbidden, Unauthorized, ValidationError
from app.core.security import hash_password, verify_password
from app.modules.audit import service as audit_service
from app.modules.auth import repository as session_repository
from app.modules.auth.models import RESET_PASSWORD, VERIFY_EMAIL, UserSession
from app.modules.auth.schemas import EMAIL_PATTERN
from app.modules.users import repository as user_repository
from app.modules.users.models import User
from app.modules.users.service import validate_password

# S6: la misma respuesta para correo inexistente, contraseña incorrecta, cuenta inactiva o
# bloqueada. Así no se puede averiguar qué correos tienen cuenta.
INVALID_CREDENTIALS = (
    "Correo o contraseña incorrectos. Tras 5 intentos fallidos el acceso se bloquea 15 minutos."
)
FAILED_LOGIN_WINDOW = timedelta(minutes=15)
EMAIL_NOT_VERIFIED = (
    "Confirma tu correo antes de ingresar: revisa tu bandeja o pide un enlace nuevo."
)
TEMP_ACCESS_EXPIRED = "La contraseña temporal venció. Pide a Administración una nueva."
INVALID_LINK = "El enlace no es válido o ya venció. Pide uno nuevo."
CAPTCHA_FAILED = "No pudimos comprobar que eres una persona. Recarga la página e intenta de nuevo."
# Respuesta igual exista o no la cuenta: no revela qué correos están registrados
CHECK_INBOX = "Si los datos son correctos, te enviamos un correo con los pasos a seguir."
MAX_FAILED_ATTEMPTS = 5
LOCK_MINUTES = 15
# Hash de referencia para gastar el mismo tiempo cuando el correo no existe y no
# revelar qué cuentas están registradas.
_DUMMY_HASH = hash_password("aspar-usuario-inexistente")


@dataclass
class LoginResult:
    session: UserSession
    user: User


def seconds_left(session: UserSession) -> int:
    return max(0, int((session.expires_at - datetime.now(UTC)).total_seconds()))


def _record(db: Session, user_or_email: User | str, ip: str | None, **event: Any) -> None:
    if isinstance(user_or_email, User):
        actor, role = user_or_email.email, user_or_email.role_name
    else:
        actor, role = user_or_email, "Sistema"
    audit_service.record(
        db,
        actor=actor,
        actor_role=role,
        category="AUTENTICACION",
        ip_address=ip,
        **({"severity": "INFO"} | event),
    )


# ---------------------------------------------------------------------------
# Sesiones
# ---------------------------------------------------------------------------
def start_session(
    db: Session, user: User, ip: str | None, user_agent: str | None, method: str
) -> LoginResult:
    now = datetime.now(UTC)
    session = session_repository.add(
        db,
        UserSession(
            user_id=user.id,
            expires_at=now + timedelta(seconds=settings.session_max_age_seconds),
            absolute_expires_at=now + timedelta(seconds=settings.session_absolute_max_seconds),
            last_activity_at=now,
            ip_address=ip,
            user_agent=(user_agent or "")[:300] or None,
        ),
    )
    user.last_login_at = now
    user.failed_login_attempts = 0
    user.locked_until = None
    _record(
        db,
        user,
        ip,
        action="Inicio de sesión",
        detail=f"Inicio de sesión de {user.email} ({user.role_name}) con {method}",
    )
    return LoginResult(session=session, user=user)


def login(
    db: Session, email: str, password: str, ip: str | None, user_agent: str | None
) -> LoginResult:
    email = email.strip().lower()
    user = user_repository.get_by_email(db, email)
    now = datetime.now(UTC)

    # bcrypt se ejecuta SIEMPRE (también si la cuenta no existe, no tiene contraseña o
    # está bloqueada): el tiempo de respuesta no revela nada.
    stored_hash = user.password_hash if user is not None else None
    password_ok = verify_password(password, stored_hash or _DUMMY_HASH) and bool(stored_hash)

    if user is not None and user.locked_until is not None and user.locked_until > now:
        audit_service.record_grouped(
            db,
            group_key=f"login_bloqueado:{email}",
            window=FAILED_LOGIN_WINDOW,
            actor=email,
            actor_role="Sistema",
            category="AUTENTICACION",
            severity="WARNING",
            action="Intento de acceso a cuenta bloqueada",
            detail=f"La cuenta {email} sigue bloqueada por intentos fallidos",
            ip_address=ip,
        )
        raise Unauthorized(INVALID_CREDENTIALS, persist=True)

    if user is None or not user.active or not password_ok:
        _register_failed_attempt(db, user, email, ip, now)
        # persist=True: el contador de intentos y la bitácora se guardan aunque falle el login
        raise Unauthorized(INVALID_CREDENTIALS, persist=True)

    # La contraseña es correcta: a partir de aquí los mensajes no revelan nada nuevo
    if not user.email_verified:
        raise Forbidden(EMAIL_NOT_VERIFIED)
    if (
        user.must_change_password
        and user.temp_password_expires_at is not None
        and user.temp_password_expires_at <= now
    ):
        raise Unauthorized(TEMP_ACCESS_EXPIRED)
    return start_session(db, user, ip, user_agent, "contraseña")


def _register_failed_attempt(
    db: Session, user: User | None, email: str, ip: str | None, now: datetime
) -> None:
    if user is not None and user.active:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=LOCK_MINUTES)
            user.failed_login_attempts = 0
            # El bloqueo es un evento aparte (crítico); los intentos se agrupan en una fila
            _record(
                db,
                email,
                ip,
                severity="CRITICAL",
                action="Cuenta bloqueada por intentos fallidos",
                detail=(
                    f"Cuenta {email} bloqueada {LOCK_MINUTES} min "
                    f"tras {MAX_FAILED_ATTEMPTS} intentos"
                ),
            )
    audit_service.record_grouped(
        db,
        group_key=f"login_fallido:{email}",
        window=FAILED_LOGIN_WINDOW,
        actor=email,
        actor_role="Sistema",
        category="AUTENTICACION",
        severity="WARNING",
        action="Intento fallido de inicio de sesión",
        detail=f"Credenciales inválidas o cuenta inactiva para {email}",
        ip_address=ip,
    )


def refresh(db: Session, user: User, session: UserSession, ip: str | None) -> UserSession:
    now = datetime.now(UTC)
    # La renovación nunca pasa del tope absoluto de la sesión
    session.expires_at = min(
        now + timedelta(seconds=settings.session_max_age_seconds), session.absolute_expires_at
    )
    session.refreshed_at = now
    session.refresh_count += 1
    _record(
        db,
        user,
        ip,
        action="Renovación de sesión",
        detail=f"Se renovó la sesión activa de {user.email}",
    )
    return session


def logout(db: Session, user: User, session: UserSession, ip: str | None) -> None:
    session.revoked_at = datetime.now(UTC)
    _record(
        db,
        user,
        ip,
        action="Cierre de sesión",
        detail=f"Sesión finalizada correctamente por {user.email}",
    )


# ---------------------------------------------------------------------------
# Correos con enlaces de un solo uso
# ---------------------------------------------------------------------------
def _send_after_commit(db: Session, sender: EmailSender, message: EmailMessage) -> None:
    # El correo sale solo si la transacción se confirma: nunca un enlace a un token
    # que no quedó guardado. Si el envío falla, queda en el log y la persona puede
    # pedir un enlace nuevo.
    after_commit(db, lambda: sender.send(message))


def _verification_email(db: Session, user: User, sender: EmailSender) -> None:
    token = session_repository.issue_token(
        db, user.id, VERIFY_EMAIL, timedelta(hours=settings.email_verification_hours)
    )
    link = f"{settings.frontend_url}/verificar-correo?token={token}"
    _send_after_commit(
        db,
        sender,
        EmailMessage(
            to=user.email,
            subject="Confirma tu correo en ASPAR",
            text=(
                f"Hola, {user.name}:\n\nPara activar tu cuenta en ASPAR, abre este enlace:\n"
                f"{link}\n\nEl enlace vence en {settings.email_verification_hours} horas. "
                "Si no creaste una cuenta, ignora este mensaje."
            ),
        ),
    )


def _reset_email(db: Session, user: User, sender: EmailSender) -> None:
    token = session_repository.issue_token(
        db, user.id, RESET_PASSWORD, timedelta(minutes=settings.password_reset_minutes)
    )
    link = f"{settings.frontend_url}/restablecer-contrasena?token={token}"
    _send_after_commit(
        db,
        sender,
        EmailMessage(
            to=user.email,
            subject="Restablece tu contraseña de ASPAR",
            text=(
                f"Hola, {user.name}:\n\nPediste restablecer tu contraseña. Abre este enlace:\n"
                f"{link}\n\nEl enlace vence en {settings.password_reset_minutes} minutos. "
                "Si no lo pediste, ignora este mensaje: tu contraseña no cambió."
            ),
        ),
    )


def _existing_account_email(user: User, db: Session, sender: EmailSender) -> None:
    _send_after_commit(
        db,
        sender,
        EmailMessage(
            to=user.email,
            subject="Ya tienes una cuenta en ASPAR",
            text=(
                f"Hola, {user.name}:\n\nAlguien intentó crear una cuenta con tu correo. "
                f"Si fuiste tú, ingresa en {settings.frontend_url}/ingresar o recupera tu "
                f"contraseña en {settings.frontend_url}/recuperar-contrasena."
            ),
        ),
    )


def require_human(turnstile_ok: bool) -> None:
    if not turnstile_ok:
        raise DomainError(CAPTCHA_FAILED)


# ---------------------------------------------------------------------------
# Registro abierto, verificación y recuperación
# ---------------------------------------------------------------------------
def register(
    db: Session, *, name: str, email: str, password: str, ip: str | None, sender: EmailSender
) -> None:
    """Cuenta nueva sin rol ("Pendiente de aprobación") hasta que Administración le asigne uno."""
    email = email.strip().lower()
    if len(name.strip()) < 3:
        raise ValidationError("Tu nombre debe tener al menos 3 caracteres.")
    if not EMAIL_PATTERN.match(email):
        raise ValidationError("Ingresa un correo electrónico válido.")
    validate_password(password)

    existing = user_repository.get_by_email(db, email)
    if existing is not None:
        _existing_account_email(existing, db, sender)
        return
    user = user_repository.add(
        db,
        User(
            name=name.strip(),
            email=email,
            password_hash=hash_password(password),
            password_changed_at=datetime.now(UTC),
            email_verified=False,
            role=None,
            active=True,
            failed_login_attempts=0,
        ),
    )
    _record(
        db,
        user,
        ip,
        action="Registro de cuenta",
        detail=f"Se registró {email}; queda pendiente de verificar su correo y de aprobación",
    )
    _verification_email(db, user, sender)


def verify_email(db: Session, token: str, ip: str | None) -> User:
    record = session_repository.consume_token(db, token, VERIFY_EMAIL)
    if record is None:
        raise ValidationError(INVALID_LINK)
    user = user_repository.get_by_id(db, record.user_id)
    user.email_verified = True
    _record(db, user, ip, action="Correo verificado", detail=f"{user.email} confirmó su correo")
    return user


def resend_verification(db: Session, email: str, sender: EmailSender) -> None:
    user = user_repository.get_by_email(db, email)
    if user is not None and user.active and not user.email_verified:
        _verification_email(db, user, sender)


def forgot_password(db: Session, email: str, ip: str | None, sender: EmailSender) -> None:
    user = user_repository.get_by_email(db, email)
    if user is None or not user.active:
        return
    _reset_email(db, user, sender)
    _record(
        db,
        user,
        ip,
        action="Solicitud de recuperación de contraseña",
        detail=f"Se envió un enlace de recuperación a {user.email}",
    )


def reset_password(db: Session, token: str, new_password: str, ip: str | None) -> None:
    validate_password(new_password)
    record = session_repository.consume_token(db, token, RESET_PASSWORD)
    if record is None:
        raise ValidationError(INVALID_LINK)
    user = user_repository.get_by_id(db, record.user_id)
    _set_password(user, new_password)
    # Abrir el enlace prueba que la persona controla el correo
    user.email_verified = True
    session_repository.revoke_all_for_user(db, user.id)
    _record(
        db,
        user,
        ip,
        severity="WARNING",
        action="Contraseña restablecida por correo",
        detail=f"{user.email} restableció su contraseña; se cerraron sus sesiones",
    )


def change_password(
    db: Session,
    user: User,
    session: UserSession,
    current_password: str | None,
    new_password: str,
    ip: str | None,
) -> None:
    if user.password_hash and not verify_password(current_password or "", user.password_hash):
        raise ValidationError("La contraseña actual no es correcta.")
    if current_password and current_password == new_password:
        raise ValidationError("La contraseña nueva debe ser distinta de la actual.")
    validate_password(new_password)
    _set_password(user, new_password)
    # Las demás sesiones abiertas (otros equipos) se cierran; esta sigue activa
    session_repository.revoke_all_for_user(db, user.id, keep=session.id)
    _record(
        db,
        user,
        ip,
        action="Cambio de contraseña propia",
        detail=f"{user.email} cambió su contraseña",
    )


def _set_password(user: User, password: str) -> None:
    user.password_hash = hash_password(password)
    user.password_changed_at = datetime.now(UTC)
    user.must_change_password = False
    user.temp_password_expires_at = None
    user.failed_login_attempts = 0
    user.locked_until = None


# ---------------------------------------------------------------------------
# Continuar con Google
# ---------------------------------------------------------------------------
GOOGLE_NOT_VERIFIED = "Tu cuenta de Google no tiene el correo verificado."
GOOGLE_LINK_BLOCKED = (
    "Ya existe una cuenta con este correo, pero aún no confirmó su correo. Confírmalo con el "
    "enlace que te enviamos o ingresa con tu contraseña."
)


def login_with_google(
    db: Session, claims: dict[str, Any], ip: str | None, user_agent: str | None
) -> LoginResult:
    if claims.get("email_verified") is not True:
        raise Forbidden(GOOGLE_NOT_VERIFIED)
    google_sub = str(claims["sub"])
    email = str(claims["email"]).strip().lower()

    user = user_repository.get_by_google_sub(db, google_sub)
    if user is None:
        user = user_repository.get_by_email(db, email)
        if user is not None:
            # Solo se vincula una cuenta cuyo dueño ya demostró controlar el correo:
            # si no, quien registró antes un correo ajeno se quedaría con la cuenta.
            if not user.email_verified:
                raise Conflict(GOOGLE_LINK_BLOCKED)
            user.google_sub = google_sub
            _record(
                db, user, ip, action="Cuenta vinculada con Google", detail=f"{email} vinculó Google"
            )
        else:
            user = user_repository.add(
                db,
                User(
                    name=_google_name(claims, email),
                    email=email,
                    google_sub=google_sub,
                    password_hash=None,
                    email_verified=True,
                    role=None,
                    active=True,
                    failed_login_attempts=0,
                ),
            )
            _record(
                db,
                user,
                ip,
                action="Registro de cuenta con Google",
                detail=f"Se registró {email} con Google; queda pendiente de aprobación",
            )
    if not user.active:
        raise Unauthorized(INVALID_CREDENTIALS)
    return start_session(db, user, ip, user_agent, "Google")


def _google_name(claims: dict[str, Any], email: str) -> str:
    name = str(claims.get("name") or "").strip()[:120]
    return name if len(name) >= 3 else email.split("@", 1)[0][:120].ljust(3, "_")
