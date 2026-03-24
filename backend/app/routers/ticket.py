from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.roles import require_end_user
from app.models.ticket import Ticket, Status, Priority
from app.models.user import UserRole

from app.schemas.ticket import TicketCreate, TicketOut

router = APIRouter(prefix="/tickets", tags=["Tickets"])


@router.post("", response_model=TicketOut)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    user=Depends(require_end_user),
):
    ticket = Ticket(
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        status=Status.open,
        user_id=user.id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("", response_model=list[TicketOut])
def list_tickets(db: Session = Depends(get_db), 
                 user=Depends(require_end_user),
                 status: Status | None = Query(default=None),
                 priority: Priority | None = Query(default=None),
                 search: str | None = Query(default=None, min_length=3),
):
    stmt = select(Ticket).where(or_(Ticket.user_id == user.id, Ticket.assigned_user_id == user.id))
    if status is not None:
        stmt = stmt.where(Ticket.status == status)
    if priority is not None:
        stmt = stmt.where(Ticket.priority == priority)
    if search:
        like_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(Ticket.title.ilike(like_term), Ticket.description.ilike(like_term))
        )
    stmt = stmt.order_by(Ticket.created_at.desc())
    return list(db.scalars(stmt).all())


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if ticket.user_id != user.id and ticket.assigned_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed to access this ticket")
    
    return ticket