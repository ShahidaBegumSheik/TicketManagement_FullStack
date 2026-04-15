import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, File, Form,Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.core.websocket_manager import manager
from app.core.cache import cache_get, cache_set
from app.routers.auth import limiter
from app.dependencies.auth import get_current_user
from app.dependencies.roles import require_end_user
from app.models.ticket import Status, Priority

from app.schemas.ticket import TicketOut, AttachmentOut, DuplicateCheckOut, TicketDetailOut, TicketReopenIn
from app.schemas.comment import CommentOut
from app.services.notification_service import create_and_send_notification
from app.services.ticketing import (
    check_similar_tickets,
    auto_escalate_old_tickets,
    validate_ticket_access,
    get_filtered_ticket_stmt,
    get_ticket_detail,
    create_ticket_with_attachments,
    upload_ticket_attachments,
    get_ticket_or_404,
    get_attachment_for_ticket,
    reopen_ticket_by_user
)

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate

router = APIRouter(prefix="/tickets", tags=["Tickets"])

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
    tags: list[str] | None = Form(default=None),
    files: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    user=Depends(require_end_user),
):
    ticket = await create_ticket_with_attachments(
        db,
        title=title,
        description=description,
        priority=priority,
        tags=tags,
        files=files,
        user=user,
    )
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
                 to_date: str | None = Query(default=None),
                 tag_names: list[str] | None = Query(default=None),
                 page: int = Query(default=1, ge=1),
                 size: int = Query(default=50, ge=1, le=100),
):
    auto_escalate_old_tickets(db)

    cache_key = "tickets:list:" + json.dumps(
        {
            "user_id": user.id,
            "role": user.role.value,
            "status": status.value if status else None,
            "priority": priority.value if priority else None,
            "search": search,
            "assigned_user_id": assigned_user_id,
            "from_date": from_date,
            "to_date": to_date,
            "page": page,
            "size": size,
            "tag_names": tag_names,
        },
        sort_keys=True,
    )

    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    
    stmt = get_filtered_ticket_stmt(
        user=user,
        status=status,
        priority=priority,
        search=search,
        assigned_user_id=assigned_user_id,
        from_date=from_date,
        to_date=to_date,
        tag_names=tag_names,
    )
    result = paginate(db, stmt)
    cache_set(cache_key, result.model_dump(mode="json"))
    return result

@router.get("/{ticket_id}", response_model=TicketDetailOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return get_ticket_detail(db, ticket_id, user)

@router.post("/{ticket_id}/attachments", response_model=list[AttachmentOut])
async def upload_attachments(
    ticket_id: int, 
    files: list[UploadFile] = File(...), 
    db: Session = Depends(get_db), 
    user=Depends(get_current_user)
):
    added = await upload_ticket_attachments(db, ticket_id, files, user)
    return [AttachmentOut.model_validate(item) for item in added]
    

@router.get("/{ticket_id}/attachments/{attachment_id}")
def download_attachment(ticket_id: int, attachment_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ticket = get_ticket_or_404(db, ticket_id)
    if not validate_ticket_access(ticket, user):
        raise HTTPException(status_code=403, detail="Not allowed")
    attachment = get_attachment_for_ticket(db, ticket_id, attachment_id)
    filepath = settings.upload_path / attachment.stored_name
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Stored file missing")
    return FileResponse(path=str(filepath), filename=attachment.original_name, media_type=attachment.mime_type)

@router.post("/{ticket_id}/reopen", response_model=TicketOut)
async def reopen_ticket(
    ticket_id: int, 
    payload: TicketReopenIn, 
    db: Session = Depends(get_db), 
    user=Depends(require_end_user)
):
    return await reopen_ticket_by_user(db, ticket_id, user, payload.reason)