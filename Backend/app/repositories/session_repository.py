from sqlalchemy.orm import Session

from app.models import UserSession


def add(db: Session, session: UserSession) -> UserSession:
    db.add(session)
    db.flush()
    return session


def get_by_id(db: Session, session_id: str) -> UserSession | None:
    return db.get(UserSession, session_id)
