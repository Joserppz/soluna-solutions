from datetime import UTC, datetime

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.modules.auth.models import UserSession


def add(db: Session, session: UserSession) -> UserSession:
    db.add(session)
    db.flush()
    return session


def get_by_id(db: Session, session_id: str) -> UserSession | None:
    return db.get(UserSession, session_id)


def revoke_all_for_user(db: Session, user_id: str) -> int:
    result = db.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    return result.rowcount
