from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.roles import require_admin

from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ticket import TicketOut, TicketUpdate
from app.schemas.admin import (AdminUserOut, AdminUserTicketsOut, UserTicketMapOut)

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/users", response_model=list[AdminUserOut])
def all_users(
    db: Session = Depends(get_db),
    admin = Depends(require_admin),
):
    stmt = select(User).order_by(User.id)
    return list(db.scalars(stmt).all())

@router.get("/tickets", response_model=list[AdminUserTicketsOut])
def all_tickets(db: Session = Depends(get_db), admin=Depends(require_admin)):
    stmt = select(Ticket).order_by(Ticket.created_at.desc())
    return list(db.scalars(stmt).all())

@router.get("/user-tickets", response_model=list[UserTicketMapOut])
def user_tickets_map(db: Session = Depends(get_db), admin=Depends(require_admin)):
    rows = db.execute(
        select(User.id, User.email, Ticket.id, Ticket.status, Ticket.description)
        .join(Ticket, Ticket.user_id == User.id)
        .order_by(User.id.desc())
    ).all()

    return [
        {
            "user_id": row[0], 
            "email": row[1], 
            "ticket_id": row[2], 
            "ticket_status": row[3], 
            "ticket_desc": row[4]
        } for row in rows
    ]

@router.patch("/tickets/{ticket_id}", response_model=TicketOut)
def update_ticket(ticket_id: int, payload: TicketUpdate,
                  db: Session = Depends(get_db),
                  admin=Depends(require_admin)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if payload.title is not None:
        ticket.title = payload.title
    if payload.description is not None:
        ticket.description = payload.description
    if payload.priority is not None:
        ticket.priority = payload.priority
    if payload.status is not None:
        ticket.status = payload.status
    
    db.commit()
    db.refresh(ticket)
    return ticket

@router.get("/users/{user_id}/tickets", response_model=list[TicketOut])
def get_user_tickets(
    user_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    stmt = select(Ticket).where(Ticket.user_id == user_id)
    return list(db.scalars(stmt).all())