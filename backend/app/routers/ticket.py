from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, File, Form,Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.security import decode_token
from app.core.websocket_manager import manager
from app.routers.auth import limiter
from app.core.database import SessionLocal, get_db
from app.dependencies.auth import get_current_user
from app.dependencies.roles import require_end_user
from app.models.attachment import TicketAttachment
from app.models.notification import Notification
from app.models.ticket import Ticket, Status, Priority
from app.models.user import User, UserRole
from app.models.comment import Comment

from app.schemas.ticket import TicketOut, TicketDetailOut,TicketReopenIn, DuplicateCheckOut, AttachmentOut, ActivityOut
from app.schemas.comment import CommentOut
from app.services.notification_service import create_and_send_notification
from app.services.ticketing import (
    check_similar_tickets,
    create_ticket_activity,
    auto_escalate_old_tickets,
    save_attachment,
    validate_ticket_access,
)

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate

router = APIRouter(prefix="/tickets", tags=["Tickets"])

def _apply_ticket_filters(stmt, *, user: User, status: Status | None, priority: Priority | None, search: str | None, assigned_user_id: int | None, from_date: str | None, to_date: str | None):
    if user.role == UserRole.admin:
        pass
    elif user.role == UserRole.support_agent:
        stmt = stmt.where(Ticket.assigned_user_id == user.id)
    else:
        stmt = stmt.where(Ticket.user_id == user.id)

    if status is not None:
        stmt = stmt.where(Ticket.status == status)
    if priority is not None:
        stmt = stmt.where(Ticket.priority == priority)
    if assigned_user_id is not None:
        stmt = stmt.where(Ticket.assigned_user_id == assigned_user_id)
    if from_date:
        stmt = stmt.where(Ticket.created_at >= from_date)
    if to_date:
        stmt = stmt.where(Ticket.created_at <= to_date)
    if search:
        like_term = f"%{search.strip()}%"
        stmt = stmt.where(or_(Ticket.title.ilike(like_term), Ticket.description.ilike(like_term)))
    return stmt

@router.get("/duplicate-check", response_model=DuplicateCheckOut)
def duplicate_check(title: str, description: str, db: Session = Depends(get_db), user=Depends(require_end_user)):
    matches = check_similar_tickets(db, user.id, title, description)
    return DuplicateCheckOut(
        is_duplicate=bool(matches),
        message="Similar open tickets found." if matches else "No similar open tickets found.",
        matches=matches,
    )

@router.post("", response_model=TicketOut)
async def create_ticket(
    request: Request,
    title: str = Form(...),
    description: str = Form(...),
    priority: Priority = Form(default=Priority.low),
    files: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    user=Depends(require_end_user),
):
    ticket = Ticket(
        title=title,
        description=description,
        priority=priority,
        status=Status.open,
        user_id=user.id,
    )
    db.add(ticket)
    db.flush()
    create_ticket_activity(db, ticket.id, user.id, "ticket_created", f"Ticket created by {user.name}.")
    for upload in files or []:
        file_bytes = await upload.read()
        save_attachment(db, ticket.id, user.id, upload, file_bytes)
        create_ticket_activity(db, ticket.id, user.id, "attachment_uploaded", f"Attachment '{upload.filename}' uploaded.")
    admins = list(db.scalars(select(User).where(User.role == UserRole.admin, User.is_active.is_(True))).all())
    for admin in admins:
        await create_and_send_notification(db, user_id=admin.id, title="New Titcket Created", 
                                           message=f"Ticket #{ticket.id} - {ticket.title} was created by {user.name}.", ticket_id=ticket.id,)
    await create_and_send_notification(db, user_id=ticket.user_id, title="Ticket Submitted", message=f"Your ticket #{ticket.id} has been created successfully.", 
                                       ticket_id=ticket.id)
    db.commit()
    db.refresh(ticket)
    auto_escalate_old_tickets(db)
    return ticket

@router.get("", response_model=Page[TicketOut])
def list_tickets(db: Session = Depends(get_db), 
                 user=Depends(get_current_user),
                 status: Status | None = Query(default=None),
                 priority: Priority | None = Query(default=None),
                 search: str | None = Query(default=None, min_length=3),
                 assigned_user_id: int | None = Query(default=None),
                 from_date: str | None = Query(default=None),
                 to_date: str | None = Query(default=None)
):
    count = auto_escalate_old_tickets(db)
    stmt = select(Ticket)
    stmt = _apply_ticket_filters(stmt, user=user, status=status, priority=priority, search=search, assigned_user_id=assigned_user_id, from_date=from_date, to_date=to_date)
    stmt = stmt.order_by(Ticket.created_at.desc())
    return paginate(db, stmt)

@router.get("/{ticket_id}", response_model=TicketDetailOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            joinedload(Ticket.user),
            joinedload(Ticket.assigned_user),
            joinedload(Ticket.attachments), 
            joinedload(Ticket.activities),
            joinedload(Ticket.comments).joinedload(Comment.user)
        )        
    )
    ticket = db.scalar(stmt)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not validate_ticket_access(ticket, user):
        raise HTTPException(status_code=403, detail="Not allowed to access this ticket")
    
    ticket_data = TicketOut.model_validate(ticket).model_dump()

    ticket_data["creator_name"] = ticket.user.name if ticket.user else None
    ticket_data["assigned_user_name"] = ticket.assigned_user.name if ticket.assigned_user else None
    ticket_data["attachments"] = [AttachmentOut.model_validate(a) for a in ticket.attachments]
    ticket_data["activities"] = [ActivityOut.model_validate(a) for a in ticket.activities]
    ticket_data["comments"] = [
        CommentOut(
            id=c.id,
            content=c.content,
            ticket_id=c.ticket_id,
            user_id=c.user_id,
            user_name=c.user.name if c.user else None,
            created_at=c.created_at,
        )
        for c in ticket.comments
    ]

    return TicketDetailOut(**ticket_data)

@router.post("/{ticket_id}/attachments", response_model=list[AttachmentOut])
async def upload_attachments(ticket_id: int, files: list[UploadFile] = File(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not validate_ticket_access(ticket, user):
        raise HTTPException(status_code=403, detail="Not allowed to upload attachments to this ticket")
    added = []
    for upload in files:
        file_bytes = await upload.read()
        item = save_attachment(db, ticket.id, user.id, upload, file_bytes)
        added.append(item)
        create_ticket_activity(db, ticket.id, user.id, "attachment_uploaded", f"Attachment '{upload.filename}' uploaded.")
    db.commit()
    return [AttachmentOut.model_validate(item) for item in added]

@router.get("/{ticket_id}/attachments/{attachment_id}")
def download_attachment(ticket_id: int, attachment_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not validate_ticket_access(ticket, user):
        raise HTTPException(status_code=403, detail="Not allowed")
    attachment = db.get(TicketAttachment, attachment_id)
    if not attachment or attachment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Attachment not found")
    filepath = settings.upload_path / attachment.stored_name
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Stored file missing")
    return FileResponse(path=str(filepath), filename=attachment.original_name, media_type=attachment.mime_type)

@router.post("/{ticket_id}/reopen", response_model=TicketOut)
async def reopen_ticket(ticket_id: int, payload: TicketReopenIn, db: Session = Depends(get_db), user=Depends(require_end_user)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.user_id != user.id:
        raise HTTPException(status_code=403, detail="Only the ticket creator can reopen the ticket")
    if ticket.status != Status.closed:
        raise HTTPException(status_code=400, detail="Only closed tickets can be reopened")

    ticket.status = Status.open
    ticket.closed_at = None
    ticket.reopened_at = ticket.updated_at
    ticket.reopen_reason = payload.reason
    create_ticket_activity(db, ticket.id, user.id, "ticket_reopened", f"Ticket reopened by {user.name}. Reason: {payload.reason}")
    if ticket.assigned_user_id:
        assigned_user = db.get(User, ticket.assigned_user_id)
        await create_and_send_notification(db, user_id=assigned_user.id, title="Ticket reopened", message=f"Ticket #{ticket.id} was reopened by {user.name}.", ticket_id=ticket.id)
    admins = list(db.scalars(select(User).where(User.role == UserRole.admin)).all())
    for admin in admins:
        await create_and_send_notification(db, user_id=admin.id, title="Ticket reopened", message=f"{user.name} reopened ticket #{ticket.id}.", ticket_id=ticket.id)
    db.commit()
    db.refresh(ticket)
    return ticket