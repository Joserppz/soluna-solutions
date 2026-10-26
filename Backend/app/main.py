"""
API Backend RESTful para ASPAR — Soluna Solutions (SCRUM-58 / SCRUM-87)
Implementa la arquitectura en capas definida en el modelo C4 (Nivel C2 y C3):
- JWT Auth Middleware & Auth Router (/api/v1/auth)
- Patient Router (/api/v1/patients)
- User & Role Router (/api/v1/users)
- Audit Router (/api/v1/audit)
- Inventory, Schedule, Multimedia & Donation Routers
"""

import base64
import hashlib
import hmac
import json
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).resolve().parent.parent / "aspar.db"
JWT_SECRET = "aspar-soluna-secret-key-2026-ucb"
SESSION_MAX_AGE_SECONDS = 30 * 60
SESSION_IDLE_LIMIT_SECONDS = 15 * 60

app = FastAPI(
    title="ASPAR API - Soluna Solutions",
    description="API Backend RESTful para el Sistema Web y de Gestión de la Asociación de Parkinson Mario Lagrava (ASPAR)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def hash_password(password: str) -> str:
    return hashlib.sha256(f"aspar_salt:{password}".encode("utf-8")).hexdigest()


def create_jwt_token(payload: Dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    h_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    p_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signing_input = f"{h_b64}.{p_b64}".encode()
    sig = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    s_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{h_b64}.{p_b64}.{s_b64}"


def verify_jwt_token(token: str) -> Dict[str, Any]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid token format")
        h_b64, p_b64, s_b64 = parts
        signing_input = f"{h_b64}.{p_b64}".encode()
        expected_sig = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
        expected_b64 = base64.urlsafe_b64encode(expected_sig).decode().rstrip("=")
        if not hmac.compare_digest(s_b64, expected_b64):
            raise ValueError("Invalid token signature")
        padded = p_b64 + "=" * (-len(p_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode())
        if int(time.time() * 1000) >= int(payload.get("exp", 0)):
            raise ValueError("Token expired")
        return payload
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Sesión inválida o expirada: {exc}",
        ) from exc


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            department TEXT DEFAULT 'General',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            ci TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            address TEXT NOT NULL,
            emergency_contact TEXT NOT NULL,
            caregiver_relation TEXT NOT NULL,
            consent INTEGER NOT NULL DEFAULT 0,
            consent_date TEXT,
            access_status TEXT NOT NULL,
            diagnosis TEXT NOT NULL,
            stage TEXT NOT NULL,
            neurologist_certificate INTEGER NOT NULL DEFAULT 0,
            symptom_notes TEXT,
            physical_evaluation TEXT,
            speech_evaluation TEXT,
            psychological_evaluation TEXT,
            medications TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            actor TEXT NOT NULL,
            actor_role TEXT NOT NULL,
            category TEXT NOT NULL,
            severity TEXT NOT NULL,
            action TEXT NOT NULL,
            detail TEXT NOT NULL,
            ip_address TEXT NOT NULL
        )
        """
    )
    cur.execute("SELECT COUNT(*) as c FROM users")
    if cur.fetchone()["c"] == 0:
        now = datetime.now(timezone.utc).isoformat()
        seed_users = [
            ("u-admin", "Greta Torrez (Directora ASPAR)", "admin@aspar.org", hash_password("Admin2026!"), "Administrador", "Dirección Ejecutiva", 1, now),
            ("u-coord", "Junior Quiroga", "coordinacion@aspar.org", hash_password("Coord2026!"), "Coordinador", "Coordinación General", 1, now),
            ("u-demo", "Lic. Ana Flores", "demo@aspar.org", hash_password("Aspar2026!"), "Profesional", "Fisioterapia y Rehabilitación", 1, now),
            ("u-recep", "Carla Mendoza", "recepcion@aspar.org", hash_password("Recep2026!"), "Recepción", "Atención y Afiliaciones", 1, now),
            ("u-vol", "Mateo Quispe", "voluntario@aspar.org", hash_password("Voluntario2026!"), "Voluntario", "Apoyo Sabatino", 1, now),
        ]
        cur.executemany(
            "INSERT INTO users (id, name, email, password_hash, role, department, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            seed_users,
        )
    cur.execute("SELECT COUNT(*) as c FROM patients")
    if cur.fetchone()["c"] == 0:
        now = datetime.now(timezone.utc).isoformat()
        seed_patients = [
            (
                "p-1",
                "Elena Rojas",
                "1234567",
                "70000001",
                "Av. Arce #2140, Sopocachi, La Paz",
                "Carlos Rojas (71522334)",
                "Hijo / Cuidador principal",
                1,
                "2026-08-15",
                "Activo",
                "Enfermedad de Parkinson idiopática",
                "Estadio II (Bilateral sin alteración del equilibrio)",
                1,
                "Temblor en reposo en miembro superior derecho y bradicinesia leve.",
                "Marcha independiente con reducción de braceo; equilibrio conservado.",
                "Hipofonía leve; articulación comprensible, requiere ejercicios de proyección vocal.",
                "Ánimo estable, alta adherencia a talleres grupales sabatinos.",
                "Levodopa/Carbidopa 250/25 mg cada 8 horas",
                now,
                now,
            ),
            (
                "p-2",
                "Miguel Fernández",
                "7654321",
                "70000002",
                "Calle 15 de Calacoto #450, La Paz",
                "Lucía Fernández (70688912)",
                "Esposa / Familiar directo",
                0,
                "",
                "Pendiente",
                "Parkinsonismo en evaluación clínica",
                "Estadio I (Leve unilateral)",
                0,
                "Rigidez matutina leve validada por observación de síntomas en admisión.",
                "Rango articular funcional; pendiente completar batería de equilibrio.",
                "Sin disfagia; fluidez verbal normal.",
                "Ansiedad leve ante diagnóstico reciente; se sugiere acompañamiento.",
                "En ajuste por neurología",
                now,
                now,
            ),
        ]
        cur.executemany(
            """
            INSERT INTO patients (
                id, name, ci, phone, address, emergency_contact, caregiver_relation,
                consent, consent_date, access_status, diagnosis, stage, neurologist_certificate,
                symptom_notes, physical_evaluation, speech_evaluation, psychological_evaluation,
                medications, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            seed_patients,
        )
    conn.commit()
    conn.close()


init_db()


class LoginPayload(BaseModel):
    email: str
    password: str


class AnamnesisPayload(BaseModel):
    diagnosis: str = "Enfermedad de Parkinson"
    stage: str = "Estadio I (Leve unilateral)"
    neurologistCertificate: bool = False
    symptomNotes: str = ""
    physicalEvaluation: str = ""
    speechEvaluation: str = ""
    psychologicalEvaluation: str = ""
    medications: str = ""


class PatientCreatePayload(BaseModel):
    name: str = Field(..., min_length=3)
    ci: str = Field(..., min_length=5)
    phone: str = Field(..., min_length=7)
    address: str = Field(default="La Paz, Bolivia")
    emergencyContact: str = Field(..., min_length=3)
    caregiverRelation: str = Field(default="Familiar / Cuidador")
    consent: bool = False
    consentDate: Optional[str] = None
    accessStatus: str = "Pendiente"
    anamnesis: Optional[AnamnesisPayload] = None


class PatientUpdatePayload(BaseModel):
    name: Optional[str] = None
    ci: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergencyContact: Optional[str] = None
    caregiverRelation: Optional[str] = None
    consent: Optional[bool] = None
    consentDate: Optional[str] = None
    accessStatus: Optional[str] = None
    anamnesis: Optional[AnamnesisPayload] = None


class UserCreatePayload(BaseModel):
    name: str
    email: str
    role: str
    department: str = "General"
    password: str = "Aspar2026!"


class UserUpdatePayload(BaseModel):
    role: Optional[str] = None
    active: Optional[bool] = None
    department: Optional[str] = None


def log_audit_db(
    actor: str,
    actor_role: str,
    category: str,
    severity: str,
    action: str,
    detail: str,
) -> None:
    conn = get_db()
    conn.execute(
        """
        INSERT INTO audit_logs (id, date, actor, actor_role, category, severity, action, detail, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            datetime.now(timezone.utc).isoformat(),
            actor,
            actor_role,
            category,
            severity,
            action,
            detail,
            "127.0.0.1",
        ),
    )
    conn.commit()
    conn.close()


def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token Bearer requerido")
    token = authorization.replace("Bearer ", "", 1).strip()
    return verify_jwt_token(token)


@app.get("/api/v1/health")
def health_check() -> Dict[str, Any]:
    return {"status": "ok", "service": "aspar-backend-api", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.post("/api/v1/auth/login")
def login(payload: LoginPayload) -> Dict[str, Any]:
    conn = get_db()
    email = payload.email.strip().lower()
    row = conn.execute("SELECT * FROM users WHERE lower(email) = ?", (email,)).fetchone()
    conn.close()

    if not row or not row["active"] or row["password_hash"] != hash_password(payload.password):
        log_audit_db(
            actor=email or "desconocido",
            actor_role="Sistema",
            category="AUTENTICACION",
            severity="WARNING",
            action="Intento fallido de inicio de sesión",
            detail=f"Credenciales inválidas o cuenta inactiva para {email}",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos, o usuario inactivo.",
        )

    now_ms = int(time.time() * 1000)
    exp_ms = now_ms + SESSION_MAX_AGE_SECONDS * 1000
    token_payload = {
        "sub": row["id"],
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
        "iat": now_ms,
        "exp": exp_ms,
    }
    token = create_jwt_token(token_payload)
    log_audit_db(
        actor=row["email"],
        actor_role=row["role"],
        category="AUTENTICACION",
        severity="INFO",
        action="Inicio de sesión administrativo",
        detail=f"Autenticación JWT exitosa para {row['email']} ({row['role']})",
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": SESSION_MAX_AGE_SECONDS,
        "idle_timeout": SESSION_IDLE_LIMIT_SECONDS,
        "user": {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "role": row["role"],
            "department": row["department"],
            "active": bool(row["active"]),
        },
    }


@app.get("/api/v1/auth/verify")
def verify_session(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return {"valid": True, "user": user}


@app.post("/api/v1/auth/logout")
def logout(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    log_audit_db(
        actor=user["email"],
        actor_role=user["role"],
        category="AUTENTICACION",
        severity="INFO",
        action="Cierre de sesión",
        detail=f"Sesión finalizada correctamente por {user['email']}",
    )
    return {"message": "Sesión cerrada correctamente"}


def row_to_patient(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "ci": row["ci"],
        "phone": row["phone"],
        "address": row["address"],
        "emergencyContact": row["emergency_contact"],
        "caregiverRelation": row["caregiver_relation"],
        "consent": bool(row["consent"]),
        "consentDate": row["consent_date"] or "",
        "accessStatus": row["access_status"],
        "anamnesis": {
            "diagnosis": row["diagnosis"],
            "stage": row["stage"],
            "neurologistCertificate": bool(row["neurologist_certificate"]),
            "symptomNotes": row["symptom_notes"] or "",
            "physicalEvaluation": row["physical_evaluation"] or "",
            "speechEvaluation": row["speech_evaluation"] or "",
            "psychologicalEvaluation": row["psychological_evaluation"] or "",
            "medications": row["medications"] or "",
        },
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


@app.get("/api/v1/patients")
def list_patients(user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    conn = get_db()
    rows = conn.execute("SELECT * FROM patients ORDER BY created_at DESC").fetchall()
    conn.close()
    return [row_to_patient(r) for r in rows]


@app.post("/api/v1/patients", status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreatePayload,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    conn = get_db()
    existing = conn.execute("SELECT id FROM patients WHERE ci = ?", (payload.ci.strip(),)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Ya existe un paciente registrado con esa Cédula de Identidad.")

    now = datetime.now(timezone.utc).isoformat()
    patient_id = f"p-{uuid.uuid4().hex[:8]}"
    anamnesis = payload.anamnesis or AnamnesisPayload()
    consent_date = payload.consentDate or (now[:10] if payload.consent else "")

    conn.execute(
        """
        INSERT INTO patients (
            id, name, ci, phone, address, emergency_contact, caregiver_relation,
            consent, consent_date, access_status, diagnosis, stage, neurologist_certificate,
            symptom_notes, physical_evaluation, speech_evaluation, psychological_evaluation,
            medications, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            patient_id,
            payload.name.strip(),
            payload.ci.strip(),
            payload.phone.strip(),
            payload.address.strip(),
            payload.emergencyContact.strip(),
            payload.caregiverRelation.strip(),
            1 if payload.consent else 0,
            consent_date,
            payload.accessStatus,
            anamnesis.diagnosis,
            anamnesis.stage,
            1 if anamnesis.neurologistCertificate else 0,
            anamnesis.symptomNotes,
            anamnesis.physicalEvaluation,
            anamnesis.speechEvaluation,
            anamnesis.psychologicalEvaluation,
            anamnesis.medications,
            now,
            now,
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
    conn.close()

    log_audit_db(
        actor=user["email"],
        actor_role=user["role"],
        category="PACIENTES",
        severity="INFO",
        action="Registro de ficha y anamnesis de paciente",
        detail=f"Se registró a {payload.name} (CI {payload.ci}) con estado {payload.accessStatus}",
    )
    return row_to_patient(row)


@app.patch("/api/v1/patients/{patient_id}")
def update_patient_endpoint(
    patient_id: str,
    payload: PatientUpdatePayload,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    conn = get_db()
    row = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    current = row_to_patient(row)
    now = datetime.now(timezone.utc).isoformat()
    new_consent = payload.consent if payload.consent is not None else current["consent"]
    new_access = payload.accessStatus if payload.accessStatus is not None else current["accessStatus"]
    if not new_consent and new_access == "Activo":
        new_access = "Pendiente"

    anam = payload.anamnesis.model_dump() if payload.anamnesis else current["anamnesis"]
    conn.execute(
        """
        UPDATE patients SET
            name = ?, ci = ?, phone = ?, address = ?, emergency_contact = ?, caregiver_relation = ?,
            consent = ?, consent_date = ?, access_status = ?, diagnosis = ?, stage = ?,
            neurologist_certificate = ?, symptom_notes = ?, physical_evaluation = ?,
            speech_evaluation = ?, psychological_evaluation = ?, medications = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            payload.name if payload.name is not None else current["name"],
            payload.ci if payload.ci is not None else current["ci"],
            payload.phone if payload.phone is not None else current["phone"],
            payload.address if payload.address is not None else current["address"],
            payload.emergencyContact if payload.emergencyContact is not None else current["emergencyContact"],
            payload.caregiverRelation if payload.caregiverRelation is not None else current["caregiverRelation"],
            1 if new_consent else 0,
            now[:10] if new_consent else "",
            new_access,
            anam["diagnosis"],
            anam["stage"],
            1 if anam["neurologistCertificate"] else 0,
            anam["symptomNotes"],
            anam["physicalEvaluation"],
            anam["speechEvaluation"],
            anam["psychologicalEvaluation"],
            anam["medications"],
            now,
            patient_id,
        ),
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
    conn.close()

    severity = "WARNING" if new_access == "Revocado" or not new_consent else "INFO"
    log_audit_db(
        actor=user["email"],
        actor_role=user["role"],
        category="CONSENTIMIENTO",
        severity=severity,
        action="Actualización de paciente / consentimiento",
        detail=f"Paciente {updated['name']} ({patient_id}): consentimiento={new_consent}, acceso={new_access}",
    )
    return row_to_patient(updated)


@app.get("/api/v1/users")
def list_users(user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    if user["role"] != "Administrador":
        raise HTTPException(status_code=403, detail="Solo el rol Administrador puede gestionar usuarios.")
    conn = get_db()
    rows = conn.execute("SELECT id, name, email, role, department, active, created_at FROM users").fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "email": r["email"],
            "role": r["role"],
            "department": r["department"],
            "active": bool(r["active"]),
            "createdAt": r["created_at"],
        }
        for r in rows
    ]


@app.post("/api/v1/users", status_code=status.HTTP_201_CREATED)
def create_user_endpoint(
    payload: UserCreatePayload,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if user["role"] != "Administrador":
        raise HTTPException(status_code=403, detail="Solo el rol Administrador puede crear usuarios.")
    conn = get_db()
    email = payload.email.strip().lower()
    if conn.execute("SELECT id FROM users WHERE lower(email) = ?", (email,)).fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo.")

    now = datetime.now(timezone.utc).isoformat()
    uid = f"u-{uuid.uuid4().hex[:8]}"
    conn.execute(
        "INSERT INTO users (id, name, email, password_hash, role, department, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (uid, payload.name.strip(), email, hash_password(payload.password), payload.role, payload.department, 1, now),
    )
    conn.commit()
    conn.close()

    log_audit_db(
        actor=user["email"],
        actor_role=user["role"],
        category="USUARIOS_ROLES",
        severity="WARNING",
        action="Alta de usuario y asignación de rol",
        detail=f"Se creó {email} con rol {payload.role} ({payload.department})",
    )
    return {
        "id": uid,
        "name": payload.name.strip(),
        "email": email,
        "role": payload.role,
        "department": payload.department,
        "active": True,
        "createdAt": now,
    }


@app.patch("/api/v1/users/{target_id}")
def update_user_endpoint(
    target_id: str,
    payload: UserUpdatePayload,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if user["role"] != "Administrador":
        raise HTTPException(status_code=403, detail="Solo el rol Administrador puede modificar roles o estados.")
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (target_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    new_role = payload.role if payload.role is not None else row["role"]
    new_active = (1 if payload.active else 0) if payload.active is not None else row["active"]
    new_dept = payload.department if payload.department is not None else row["department"]
    conn.execute(
        "UPDATE users SET role = ?, active = ?, department = ? WHERE id = ?",
        (new_role, new_active, new_dept, target_id),
    )
    conn.commit()
    conn.close()

    log_audit_db(
        actor=user["email"],
        actor_role=user["role"],
        category="USUARIOS_ROLES",
        severity="CRITICAL" if not new_active else "WARNING",
        action="Cambio de rol o estado de usuario",
        detail=f"Usuario {row['email']}: rol={new_role}, activo={bool(new_active)}",
    )
    return {
        "id": target_id,
        "name": row["name"],
        "email": row["email"],
        "role": new_role,
        "department": new_dept,
        "active": bool(new_active),
    }


@app.get("/api/v1/audit")
def list_audit_events(
    category: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    user: Dict[str, Any] = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    if user["role"] != "Administrador":
        log_audit_db(
            actor=user["email"],
            actor_role=user["role"],
            category="SISTEMA",
            severity="CRITICAL",
            action="Intento de acceso no autorizado a bitácora",
            detail=f"El usuario {user['email']} ({user['role']}) intentó consultar /api/v1/audit",
        )
        raise HTTPException(status_code=403, detail="Acceso exclusivo para Administradores.")

    conn = get_db()
    query = "SELECT * FROM audit_logs WHERE 1=1"
    params: List[Any] = []
    if category:
        query += " AND category = ?"
        params.append(category)
    if severity:
        query += " AND severity = ?"
        params.append(severity)
    query += " ORDER BY date DESC LIMIT 500"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "date": r["date"],
            "actor": r["actor"],
            "actorRole": r["actor_role"],
            "category": r["category"],
            "severity": r["severity"],
            "action": r["action"],
            "detail": r["detail"],
            "ipAddress": r["ip_address"],
        }
        for r in rows
    ]
