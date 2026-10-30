import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.auth.models import AuthToken, UserSession


def add(db: Session, session: UserSession) -> UserSession:
    db.add(session)
    db.flush()
    return session


def get_by_id(db: Session, session_id: uuid.UUID) -> UserSession | None:
    return db.get(UserSession, session_id)


def revoke_all_for_user(db: Session, user_id: uuid.UUID, keep: uuid.UUID | None = None) -> int:
    """Cierra las sesiones abiertas del usuario (salvo ``keep``, la sesión actual)."""
    query = update(UserSession).where(
        UserSession.user_id == user_id, UserSession.revoked_at.is_(None)
    )
    if keep is not None:
        query = query.where(UserSession.id != keep)
    return db.execute(query.values(revoked_at=datetime.now(UTC))).rowcount


def _hash(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def issue_token(db: Session, user_id: uuid.UUID, purpose: str, lifetime: timedelta) -> str:
    """Crea un enlace de un solo uso; los anteriores del mismo tipo dejan de servir."""
    now = datetime.now(UTC)
    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user_id,
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    raw = secrets.token_urlsafe(32)
    db.add(
        AuthToken(
            user_id=user_id, purpose=purpose, token_hash=_hash(raw), expires_at=now + lifetime
        )
    )
    db.flush()
    return raw


def consume_token(db: Session, raw_token: str, purpose: str) -> AuthToken | None:
    """Marca el token como usado y lo devuelve; None si no existe, ya se usó o venció."""
    token = db.scalar(
        select(AuthToken)
        .where(AuthToken.token_hash == _hash(raw_token), AuthToken.purpose == purpose)
        .with_for_update()
    )
    now = datetime.now(UTC)
    if token is None or token.used_at is not None or token.expires_at <= now:
        return None
    token.used_at = now
    return token
