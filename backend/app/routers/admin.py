from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.roles import require_admin

from app.models.ticket import Ticket, Priority, Status
from app.models.user import User, UserRole
from app.schemas.ticket import TicketOut, TicketUpdate
from app.schemas.admin import (AdminUserOut, AdminUserTicketsOut, UserTicketMapOut, DashboardStatsOut)

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/users", response_model=list[AdminUserOut])
def all_users(
    db: Session = Depends(get_db),
    admin = Depends(require_admin),
):
    stmt = select(User).order_by(User.id)
    return list(db.scalars(stmt).all())


@router.patch("/users/{user_id}/status", response_model=AdminUserOut)
def toggle_user_status(
    user_id: int,
    is_active: bool,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and not is_active:
        raise HTTPException(status_code=400, detail="Admin cannot deactivate own account")

    user.is_active = is_active
    db.commit()
    db.refresh(user)
    
    return user


@router.get("/tickets", response_model=list[AdminUserTicketsOut])
def all_tickets(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
    status: Status | None = Query(default=None),
    priority: Priority | None = Query(default=None),
    search: str | None = Query(default=None, min_length=1),
    ):
    stmt = select(Ticket).order_by(Ticket.created_at.desc())
    if status is not None:
        stmt = stmt.where(Ticket.status == status)
    if priority is not None:
        stmt = stmt.where(Ticket.priority == priority)
    if search:
        like_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(Ticket.title.ilike(like_term), Ticket.description.ilike(like_term))
            )
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
    if payload.assigned_user_id is not None:
        assignee = db.get(User, payload.assigned_user_id)
        if not assignee:
            raise HTTPException(status_code=404, detail="Assigned user not found")
        if assignee.role != UserRole.user:
            raise HTTPException(status_code=400, detail="Only normal users can be assigned tickets")
        if not assignee.is_active:
            raise HTTPException(status_code=400, detail="Cannot assign ticket to an inactive user")
        ticket.assigned_user_id = payload.assigned_user_id

        if ticket.status == "open":
            ticket.status = "in_progress"
    
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/users/{user_id}/tickets", response_model=list[TicketOut])
def get_user_tickets(
    user_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    stmt = (select(Ticket).where(or_(Ticket.user_id == user_id, Ticket.assigned_user_id == user_id))
    .order_by(Ticket.created_at.desc())
    )
    return list(db.scalars(stmt).all())


@router.get("/dashboard-stats", response_model=DashboardStatsOut)
def dashboard_stats(db: Session = Depends(get_db), admin=Depends(require_admin)):
    total_tickets = db.scalar(select(func.count(Ticket.id))) or 0

    def count_by_status(value: Status) -> int:
        return db.scalar(select(func.count(Ticket.id)).where(Ticket.status == value)) or 0

    def count_by_priority(value: Priority) -> int:
        return db.scalar(select(func.count(Ticket.id)).where(Ticket.priority == value)) or 0

    return DashboardStatsOut(
        total_tickets=total_tickets,
        open_tickets=count_by_status(Status.open),
        in_progress_tickets=count_by_status(Status.in_progress),
        closed_tickets=count_by_status(Status.closed),
        cancelled_tickets=count_by_status(Status.cancelled),
        urgent_tickets=count_by_priority(Priority.urgent),
        high_tickets=count_by_priority(Priority.high),
        medium_tickets=count_by_priority(Priority.medium),
        low_tickets=count_by_priority(Priority.low),
    )