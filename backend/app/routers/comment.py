from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.roles import require_admin
from app.models.ticket import Ticket
from app.models.user import UserRole
from app.models.comment import Comment
from app.schemas.comment import CommentCreate, CommentOut

router = APIRouter(prefix="/tickets", tags=["comments"])

@router.post("/{ticket_id}/comments", response_model=CommentOut)
def add_comment(ticket_id: int, payload: CommentCreate, 
                db: Session = Depends(get_db), user=Depends(get_current_user)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    allowed = (
        user.role == UserRole.admin or ticket.user_id == user.id or ticket.assigned_user_id == user.id
    )

    if not allowed:
        raise HTTPException(status_code=403, detail="Not allowed to comment on this ticket")
    
    comment = Comment(
        content=payload.content,
        ticket_id=ticket_id,
        user_id=user.id,
    )

    db.add(comment)
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

@router.get("/{ticket_id}/comments", response_model=list[CommentOut])
def get_comments(ticket_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    allowed = (
        user.role == UserRole.admin or ticket.user_id == user.id or ticket.assigned_user_id == user.id
    )

    if not allowed:
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

