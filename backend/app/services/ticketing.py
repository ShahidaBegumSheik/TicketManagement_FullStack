import os
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.activity import TicketActivity
from app.models.attachment import TicketAttachment
from app.models.ticket import Priority, Status, Ticket
from app.models.user import User, UserRole

ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/jpg", "application/pdf"}
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".pdf"}

def create_ticket_activity(db: Session, ticket_id: int, actor_user_id: int | None, action: str, message: str) -> TicketActivity:
    activity = TicketActivity(ticket_id=ticket_id, actor_user_id=actor_user_id, action=action, message=message)
    db.add(activity)
    db.flush()
    return activity

def validate_ticket_access(ticket: Ticket, user: User) -> bool:
    if user.role == UserRole.admin:
        return True
    if user.role == UserRole.support_agent:
        return ticket.assigned_user_id == user.id
    return ticket.user_id == user.id or ticket.assigned_user_id == user.id

def validate_upload(file: UploadFile, file_bytes: bytes) -> None:
    extension = Path(file.filename or "").suffix.lower()
    if file.content_type not in ALLOWED_CONTENT_TYPES or extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, and PDF files are allowed.")
    if len(file_bytes) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=400, detail="File size cannot exceed 5 MB.")

def save_attachment(db: Session, ticket_id: int, user_id: int, file: UploadFile, file_bytes: bytes) -> TicketAttachment:
    validate_upload(file, file_bytes)
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    extension = Path(file.filename or "").suffix.lower()
    stored_name = f"{uuid4().hex}{extension}"
    target = settings.upload_path / stored_name
    target.write_bytes(file_bytes)

    attachment = TicketAttachment(
        ticket_id=ticket_id,
        uploaded_by_user_id=user_id,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(file_bytes),
    )
    db.add(attachment)
    db.flush()
    return attachment

def check_similar_tickets(db: Session, user_id: int, title: str, description: str, limit: int = 5) -> list[Ticket]:
    title_term = f"%{title.strip()}%"
    desc_term = f"%{' '.join(description.strip().split()[:5])}%"
    stmt = (
        select(Ticket)
        .where(
            Ticket.user_id == user_id,
            or_(Ticket.title.ilike(title_term), Ticket.description.ilike(desc_term)),
            Ticket.status != Status.closed,
        )
        .order_by(Ticket.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())

def auto_escalate_old_tickets(db):
    cutoff = datetime.utcnow() - timedelta(hours=48)

    tickets = db.scalars(
        select(Ticket).where(
            Ticket.status == Status.open,
            Ticket.created_at <= cutoff,
            Ticket.priority.in_([Priority.low, Priority.medium]),
        )
    ).all()

    changed = False

    for ticket in tickets:
        ticket.priority = Priority.high
        changed = True

    if changed:
        db.commit()

    return len(tickets)



def pagination_meta(page: int, limit: int, total: int) -> dict:
    total_pages = max((total + limit - 1) // limit, 1) if limit else 1
    return {"page": page, "limit": limit, "total": total, "total_pages": total_pages}

def calculate_average_resolution_hours(db: Session) -> float:
    rows = db.execute(
        select(Ticket.created_at, Ticket.closed_at).where(Ticket.closed_at.is_not(None))
    ).all()
    if not rows:
        return 0.0
    values = []
    for created_at, closed_at in rows:
        if created_at and closed_at:
            values.append((closed_at - created_at).total_seconds() / 3600)
    if not values:
        return 0.0
    return round(sum(values) / len(values), 2)
