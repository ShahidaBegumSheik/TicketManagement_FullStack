import os
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.cache import cache_delete_prefix
from app.models.activity import TicketActivity
from app.models.attachment import TicketAttachment
from app.models.ticket import Priority, Status, Ticket
from app.models.user import User, UserRole
from app.models.comment import Comment
from app.models.saved_filter import SavedFilter
from app.models.tag import Tag
from app.schemas.ticket import TicketDetailOut, TicketOut, AttachmentOut, ActivityOut
from app.schemas.comment import CommentOut
from app.services.notification_service import create_and_send_notification

ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/jpg", "application/pdf"}
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".pdf"}

def apply_tag_filter(stmt, tag_names: list[str] | None):
    if tag_names:
        stmt = stmt.join(Ticket.tags).where(Tag.name.in_(tag_names)).distinct()
    return stmt

def apply_ticket_filters(stmt, 
                         *, 
                         user: User, 
                         status: Status | None, 
                         priority: Priority | None, 
                         search: str | None, 
                         assigned_user_id: int | None, 
                         from_date: str | None, 
                         to_date: str | None,
                         tag_names: list[str] | None = None,
):
    if user.role == UserRole.admin:
        pass
    elif user.role == UserRole.support_agent:
        stmt = stmt.where(Ticket.assigned_user_id == user.id)
    else:
        stmt = stmt.where(Ticket.user_id == user.id)

    stmt = stmt.where(Ticket.is_deleted.is_(False))

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
    
    stmt = apply_tag_filter(stmt, tag_names)
    return stmt


def apply_ticket_access_filter(stmt, user: User):
    if user.role == UserRole.admin:
        return stmt
    if user.role == UserRole.support_agent:
        return stmt.where(Ticket.assigned_user_id == user.id)
    return stmt.where(Ticket.user_id == user.id)


def build_fallback_search_stmt(
    *,
    user: User,
    search: str,
    status: Status | None,
    priority: Priority | None,
    assigned_user_id: int | None,
    from_date: str | None,
    to_date: str | None,
    tag_names: list[str] | None = None,
):
    like_term = f"%{search.strip()}%"

    stmt = (
        select(Ticket)
        .outerjoin(joinedload(Ticket.tags))
        .outerjoin(Comment, Comment.ticket_id == Ticket.id)
        .where(
            or_(
                Ticket.title.ilike(like_term),
                Ticket.description.ilike(like_term),
                Comment.content.ilike(like_term),
            )
        )
        .distinct()
    )

    stmt = apply_ticket_filters(
        stmt,
        user=user,
        status=status,
        priority=priority,
        search=search,
        assigned_user_id=assigned_user_id,
        from_date=from_date,
        to_date=to_date,
        tag_names=tag_names,
    )

    return stmt.order_by(Ticket.created_at.desc())


def build_fulltext_search_stmt(
    *,
    user: User,
    search: str,
    status: Status | None,
    priority: Priority | None,
    assigned_user_id: int | None,
    from_date: str | None,
    to_date: str | None,
    tag_names: list[str] | None = None,
):
    query = search.strip()
    if not query:
        return None

    boolean_query = " ".join(f"{token}*" for token in query.split() if token.strip())
    if not boolean_query:
        return None

    ticket_score_expr = text(
        "MATCH(tickets.title, tickets.description) AGAINST (:natural_q IN NATURAL LANGUAGE MODE)"
    )
    ticket_match_expr = text(
        "MATCH(tickets.title, tickets.description) AGAINST (:boolean_q IN BOOLEAN MODE)"
    )

    comment_score_expr = text(
        "MATCH(comments.content) AGAINST (:natural_q IN NATURAL LANGUAGE MODE)"
    )
    comment_match_expr = text(
        "MATCH(comments.content) AGAINST (:boolean_q IN BOOLEAN MODE)"
    )

    comment_score_subq = (
        select(
            Comment.ticket_id.label("ticket_id"),
            func.max(comment_score_expr).label("comment_score"),
        )
        .where(comment_match_expr)
        .group_by(Comment.ticket_id)
        .subquery()
    )

    stmt = (
        select(
            Ticket,
            (
                func.coalesce(ticket_score_expr, 0.0) +
                func.coalesce(comment_score_subq.c.comment_score, 0.0)
            ).label("relevance_score")
        )
        .options(joinedload(Ticket.tags))
        .outerjoin(comment_score_subq, comment_score_subq.c.ticket_id == Ticket.id)
        .where(
            or_(
                ticket_match_expr,
                comment_score_subq.c.ticket_id.is_not(None),
            )
        )
        .params(
            natural_q=query,
            boolean_q=boolean_query,
        )
    )

    stmt = apply_ticket_filters(
        stmt,
        user=user,
        status=status,
        priority=priority,
        search=search,
        assigned_user_id=assigned_user_id,
        from_date=from_date,
        to_date=to_date,
        tag_names=tag_names,
    )

    return stmt.order_by(text("relevance_score DESC"), Ticket.created_at.desc())


def get_filtered_ticket_stmt(
        *,
        user: User,
        status: Status | None,
        priority: Priority | None,
        search: str | None,
        assigned_user_id: int | None,
        from_date: str | None,
        to_date: str | None,
        tag_names: list[str] | None = None,
):
    #count = auto_escalate_old_tickets(db)
    return get_ticket_search_stmt(
        user=user,
        status=status,
        priority=priority,
        search=search,
        assigned_user_id=assigned_user_id,
        from_date=from_date,
        to_date=to_date,
        tag_names=tag_names,
    )

def get_ticket_search_stmt(
    *,
    user: User,
    status: Status | None,
    priority: Priority | None,
    search: str | None,
    assigned_user_id: int | None,
    from_date: str | None,
    to_date: str | None,
    tag_names: list[str] | None = None,
):
    # no search text -> normal list
    if not search or not search.strip():
        stmt = select(Ticket).options(joinedload(Ticket.tags))
        stmt = apply_ticket_filters(
            stmt,
            user=user,
            status=status,
            priority=priority,
            search=search,
            assigned_user_id=assigned_user_id,
            from_date=from_date,
            to_date=to_date,
            tag_names=tag_names,
        )
        return stmt.order_by(Ticket.created_at.desc())

    # try MySQL fulltext first
    try:
        stmt = build_fulltext_search_stmt(
            user=user,
            search=search,
            status=status,
            priority=priority,
            assigned_user_id=assigned_user_id,
            from_date=from_date,
            to_date=to_date,
            tag_names=tag_names,
        )
        if stmt is not None:
            return stmt
    except SQLAlchemyError:
        pass

    # fallback
    return build_fallback_search_stmt(
        user=user,
        search=search,
        status=status,
        priority=priority,
        assigned_user_id=assigned_user_id,
        from_date=from_date,
        to_date=to_date,
        tag_names=tag_names,
    )

def get_ticket_detail(db: Session, ticket_id: int, user: User):
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            joinedload(Ticket.user),
            joinedload(Ticket.assigned_user),
            joinedload(Ticket.attachments), 
            joinedload(Ticket.activities),
            joinedload(Ticket.comments).joinedload(Comment.user),
            joinedload(Ticket.tags),
        )        
    )
    ticket = db.scalar(stmt)

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.is_deleted:
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

def get_or_create_tags(db: Session, tag_names: list[str]) -> list[Tag]:
    normalized_names = []
    seen = set()

    for name in tag_names:
        clean = name.strip()
        if not clean:
            continue
        key = clean.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized_names.append(clean)

    if not normalized_names:
        return []

    existing_tags = list(
        db.scalars(select(Tag).where(Tag.name.in_(normalized_names))).all()
    )

    existing_names = {tag.name for tag in existing_tags}
    new_tags = []

    for name in normalized_names:
        if name not in existing_names:
            tag = Tag(name=name)
            db.add(tag)
            new_tags.append(tag)

    if new_tags:
        db.flush()

    return existing_tags + new_tags

def set_ticket_tags(db: Session, ticket: Ticket, tag_names: list[str]) -> None:
    tags = get_or_create_tags(db, tag_names)
    ticket.tags = tags
    db.flush()

async def create_ticket_with_attachments(
        db: Session,
        *,
        title: str,
        description: str,
        priority: Priority,
        tags: list[str] | None,
        files,
        user: User,
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
    if tags:
        set_ticket_tags(db, ticket, tags)
    create_ticket_activity(db, ticket.id, user.id, "ticket_created", f"Ticket created by {user.name}.")
    for upload in files or []:
        file_bytes = await upload.read()
        save_attachment(db, ticket.id, user.id, upload, file_bytes)
        create_ticket_activity(db, ticket.id, user.id, "attachment_uploaded", f"Attachment '{upload.filename}' uploaded.")
    admins = list(db.scalars(select(User).where(User.role == UserRole.admin, User.is_active.is_(True))).all())
    for admin in admins:
        await create_and_send_notification(db, user_id=admin.id, title="New Ticket Created", 
                                           message=f"Ticket #{ticket.id} - {ticket.title} was created by {user.name}.", ticket_id=ticket.id,)
    await create_and_send_notification(db, user_id=ticket.user_id, title="Ticket Submitted", message=f"Your ticket #{ticket.id} has been created successfully.", 
                                       ticket_id=ticket.id)
    db.commit()
    db.refresh(ticket)
    # auto_escalate_old_tickets(db)
    invalidate_ticket_caches()
    return ticket 

async def upload_ticket_attachments(db: Session, ticket_id: int, files, user: User):
    ticket = get_ticket_or_404(db, ticket_id)
    if not validate_ticket_access(ticket, user):
        raise HTTPException(status_code=403, detail="Not allowed to upload attachments to this ticket")
    added = []
    for upload in files:
        file_bytes = await upload.read()
        item = save_attachment(db, ticket.id, user.id, upload, file_bytes)
        added.append(item)
        create_ticket_activity(db, ticket.id, user.id, "attachment_uploaded", f"Attachment '{upload.filename}' uploaded.")
    db.commit()
    invalidate_ticket_caches()
    return added

def get_ticket_or_404(db: Session, ticket_id: int) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if not ticket or ticket.is_deleted:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

def get_attachment_for_ticket(db: Session, ticket_id: int, attachment_id: int) -> TicketAttachment:
    attachment = db.get(TicketAttachment, attachment_id)
    if not attachment or attachment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return attachment

async def reopen_ticket_by_user(db: Session, ticket_id: int, user: User, reason: str):
    ticket = get_ticket_or_404(db, ticket_id)
    if ticket.user_id != user.id:
        raise HTTPException(status_code=403, detail="Only the ticket creator can reopen the ticket")
    if ticket.status != Status.closed:
        raise HTTPException(status_code=400, detail="Only closed tickets can be reopened")

    ticket.status = Status.open
    ticket.closed_at = None
    ticket.reopened_at = ticket.updated_at
    ticket.reopen_reason = reason
    create_ticket_activity(db, ticket.id, user.id, "ticket_reopened", f"Ticket reopened by {user.name}. Reason: {reason}")
    if ticket.assigned_user_id:
        assigned_user = db.get(User, ticket.assigned_user_id)
        await create_and_send_notification(db, user_id=assigned_user.id, 
                                           title="Ticket reopened", 
                                           message=f"Ticket #{ticket.id} was reopened by {user.name}.", 
                                           ticket_id=ticket.id)
    admins = list(db.scalars(select(User).where(User.role == UserRole.admin)).all())
    for admin in admins:
        await create_and_send_notification(db, user_id=admin.id, 
                                           title="Ticket reopened", message=f"{user.name} reopened ticket #{ticket.id}.", 
                                           ticket_id=ticket.id)
    db.commit()
    db.refresh(ticket)
    invalidate_ticket_caches()
    return ticket

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

def create_saved_filter(db: Session, user_id: int, payload) -> SavedFilter:
    saved_filter = SavedFilter(
        name=payload.name,
        user_id=user_id,
        filter_config={
            "status": payload.status.value if payload.status else None,
            "priority": payload.priority.value if payload.priority else None,
            "assigned_user_id": payload.assigned_user_id,
            "tag_names": payload.tag_names,
            "search": payload.search,
            "from_date": payload.from_date,
            "to_date": payload.to_date,
        },
    )
    db.add(saved_filter)
    db.commit()
    db.refresh(saved_filter)
    return saved_filter


def list_saved_filters(db: Session, user_id: int) -> list[SavedFilter]:
    stmt = (
        select(SavedFilter)
        .where(SavedFilter.user_id == user_id)
        .order_by(SavedFilter.created_at.desc())
    )
    return list(db.scalars(stmt).all())


def get_saved_filter_or_404(db: Session, filter_id: int, user_id: int) -> SavedFilter:
    saved_filter = db.get(SavedFilter, filter_id)
    if not saved_filter or saved_filter.user_id != user_id:
        raise HTTPException(status_code=404, detail="Saved filter not found")
    return saved_filter


def delete_saved_filter(db: Session, filter_id: int, user_id: int) -> None:
    saved_filter = db.get(SavedFilter, filter_id)
    if not saved_filter or saved_filter.user_id != user_id:
        raise HTTPException(status_code=404, detail="Saved filter not found")
    db.delete(saved_filter)
    db.commit()

def invalidate_ticket_caches() -> None:
    cache_delete_prefix("tickets:list:")
    cache_delete_prefix("admin:tickets:list:")
    cache_delete_prefix("dashboard:stats")
    cache_delete_prefix("dashboard:analytics")
