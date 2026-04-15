from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.ticket import Ticket
from app.models.comment import Comment
from app.schemas.comment import CommentOut
from app.services.ticketing import create_ticket_activity, validate_ticket_access
from app.services.notification_service import create_and_send_notification

async def add_ticket_comment(db: Session, ticket_id: int, payload, user) -> CommentOut:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not validate_ticket_access(ticket, user):
        raise HTTPException(status_code=403, detail="Not allowed to comment on this ticket")
    comment = Comment(
        content=payload.content,
        ticket_id=ticket_id,
        user_id=user.id,
    )

    db.add(comment)
    db.flush()
    create_ticket_activity(db, ticket_id, user.id, "comment_added", f"Comment added by {user.name}.")
    if ticket.user_id != user.id:
        await create_and_send_notification(db, user_id=ticket.user_id, title="New ticket comment", message=f"{user.name} commented on ticket #{ticket.id}.", ticket_id=ticket.id)
    db.commit()
    db.refresh(comment)

    return CommentOut(
        id=comment.id,
        content=comment.content,
        ticket_id=comment.ticket_id,
        user_id=comment.user_id,
        user_name=user.name,
        created_at=comment.created_at,
    )

def list_ticket__comments(db: Session, ticket_id: int, user) -> list[CommentOut]:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not validate_ticket_access(ticket, user):
        raise HTTPException(status_code=403, detail="Not allowed to comment on this ticket")
    stmt = (
        select(Comment).options(joinedload(Comment.user))
        .where(Comment.ticket_id == ticket_id)
        .order_by(Comment.created_at.asc())
    )
    comments = list(db.scalars(stmt).all())

    return [ CommentOut(
        id=comment.id,
        content=comment.content,
        ticket_id=comment.ticket_id,
        user_id=comment.user_id,
        user_name=comment.user.name if comment.user else None,
        created_at=comment.created_at,
    ) for comment in comments
    ]