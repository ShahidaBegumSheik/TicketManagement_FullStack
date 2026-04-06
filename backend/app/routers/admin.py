import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.roles import require_admin

from app.models.ticket import Ticket, Priority, Status
from app.models.user import User, UserRole
from app.schemas.admin import AdminUserOut, DashboardAnalyticsOut, DashboardStatsOut
from app.schemas.ticket import TicketOut, TicketUpdate
from app.services.notification_service import create_and_send_notification
from app.services.ticketing import ( 
    calculate_average_resolution_hours, 
    create_ticket_activity,
    auto_escalate_old_tickets,
    )

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate

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

@router.put("/users/{user_id}/role", response_model=AdminUserOut)
def update_user_role(
    user_id: int,
    role: UserRole,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    user = db.get(User, user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot change your own role"
        )
    
    if user.role == UserRole.admin:
        raise HTTPException(
            status_code=400,
            detail="Admin role cannot be changed"
        )

    user.role = role
    db.commit()
    db.refresh(user)
    return user


@router.get("/tickets", response_model=Page[TicketOut])
def all_tickets(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
    status: Status | None = Query(default=None),
    priority: Priority | None = Query(default=None),
    search: str | None = Query(default=None, min_length=1),
    assigned_user_id: int | None = Query(default=None),
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    ):
    count = auto_escalate_old_tickets(db)
    stmt = select(Ticket).order_by(Ticket.created_at.desc())
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
        stmt = stmt.where(
            or_(Ticket.title.ilike(like_term), Ticket.description.ilike(like_term))
            )
    stmt = stmt.order_by(Ticket.created_at.desc())
    return paginate(db,stmt)


@router.patch("/tickets/{ticket_id}", response_model=TicketOut)
async def update_ticket(ticket_id: int, payload: TicketUpdate,
                  db: Session = Depends(get_db),
                  actor=Depends(get_current_user)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if actor.role == UserRole.support_agent:
        if ticket.assigned_user_id != actor.id:
            raise HTTPException(status_code=403, detail="Support agents can only update their assigned tickets")
        if payload.assigned_user_id is not None or payload.priority is not None or payload.title is not None or payload.description is not None:
            raise HTTPException(status_code=403, detail="Support agents can only update ticket status")
    elif actor.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not allowed")

    previous_status = ticket.status
    previous_priority = ticket.priority
    previous_assignee = ticket.assigned_user_id
    if payload.title is not None:
        ticket.title = payload.title
    if payload.description is not None:
        ticket.description = payload.description
    if payload.priority is not None:
        ticket.priority = payload.priority
    if payload.status is not None:
        ticket.status = Status(payload.status)
        if payload.status == Status.closed:
            ticket.closed_at = datetime.now(timezone.utc)
        elif previous_status == Status.closed and payload.status != Status.closed:
            ticket.closed_at = None
    if payload.assigned_user_id is not None:
        if payload.assigned_user_id == 0:
            ticket.assigned_user_id = None
        else:
            assignee = db.get(User, payload.assigned_user_id)
            if not assignee:
                raise HTTPException(status_code=404, detail="Assigned user not found")
            if assignee.role not in {UserRole.support_agent, UserRole.admin}:
                raise HTTPException(status_code=400, detail="Ticket can only be assigned to a support agent or admin")
            if not assignee.is_active:
                raise HTTPException(status_code=400, detail="Cannot assign ticket to an inactive user")
            ticket.assigned_user_id = payload.assigned_user_id

            if ticket.status == "open":
                ticket.status = "in_progress"
    if previous_status != ticket.status:
        create_ticket_activity(db, ticket.id, actor.id, "status_updated", f"Status changed from {str(previous_status)} to {str(ticket.status)} by {actor.name}.")
        await create_and_send_notification(db, user_id=ticket.user_id, 
                                           title="Ticket status updated", 
                                           message=f"Ticket #{ticket.id} status changed to {ticket.status}.", ticket_id=ticket.id)
        await create_and_send_notification(db, user_id=actor.id, title="Ticket status changed", 
                                           message=f"You changed ticket #{ticket.id} status to {ticket.status.value}.",
                                           ticket_id=ticket.id,
                                           )


        if ticket.assigned_user_id and ticket.assigned_user_id != actor.id:
            assigned_user = db.get(User, ticket.assigned_user_id)
            await create_and_send_notification(db, user_id=ticket.assigned_user_id, title="Ticket status updated", message=f"Ticket #{ticket.id} status changed to {ticket.status.value}.", ticket_id=ticket.id)

    if previous_priority != ticket.priority:
        create_ticket_activity(db, ticket.id, actor.id, "priority_updated", f"Priority changed from {previous_priority.value} to {ticket.priority.value} by {actor.name}.")
        await create_and_send_notification(db, user_id=ticket.assigned_user_id, title="Ticket priority changed", message=f"Ticket #{ticket.id} priority changed from {previous_priority.value} to {ticket.priority.value}.", ticket_id=ticket.id)
        await create_and_send_notification(db, user_id=actor.id, title="Ticket priority changed", 
                                           message=f"You changed ticket #{ticket.id} priority to {ticket.priority.value}.",
                                           ticket_id=ticket.id,
                                           )

    if previous_assignee != ticket.assigned_user_id:
        assignee = db.get(User, ticket.assigned_user_id) if ticket.assigned_user_id else None
        assignee_name = assignee.name if assignee else "Unassigned"
        create_ticket_activity(db, ticket.id, actor.id, "ticket_assigned", f"Ticket assigned to {assignee_name} by {actor.name}.")
        if assignee:
            await create_and_send_notification(db, user_id=assignee.id, title="Ticket assigned", message=f"You were assigned ticket #{ticket.id}.", ticket_id=ticket.id)
            await create_and_send_notification(db, user_id=actor.id, title="Ticket assignment updated", 
                                           message=f"You assigned ticket #{ticket.id} to {assignee_name}.",
                                           ticket_id=ticket.id,
                                           )
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/run-auto-escalation")
def run_auto_escalation(db: Session = Depends(get_db), admin=Depends(require_admin)):
    changed = auto_escalate_old_tickets(db)
    return {"message": "Auto escalation executed", "tickets_updated": changed}


@router.get("/dashboard-stats", response_model=DashboardStatsOut)
def dashboard_stats(db: Session = Depends(get_db), admin=Depends(require_admin)):
    total_tickets = db.scalar(select(func.count(Ticket.id))) or 0
    
    status_rows = db.execute(
        select(Ticket.status, func.count(Ticket.id))
        .group_by(Ticket.status)
    ).all()

    priority_rows = db.execute(
        select(Ticket.priority, func.count(Ticket.id))
        .group_by(Ticket.priority)
    ).all()

    status_counts = {status: count for status, count in status_rows}
    priority_counts = {priority: count for priority, count in priority_rows}

    return DashboardStatsOut(
        total_tickets=total_tickets,
        open_tickets=status_counts.get(Status.open, 0),
        in_progress_tickets=status_counts.get(Status.in_progress, 0),
        closed_tickets=status_counts.get(Status.closed, 0),
        cancelled_tickets=status_counts.get(Status.cancelled, 0),
        urgent_tickets=priority_counts.get(Priority.urgent, 0),
        high_tickets=priority_counts.get(Priority.high, 0),
        medium_tickets=priority_counts.get(Priority.medium, 0),
        low_tickets=priority_counts.get(Priority.low, 0),
    )

@router.get("/dashboard-analytics", response_model=DashboardAnalyticsOut)
def dashboard_analytics(db: Session = Depends(get_db), admin=Depends(require_admin)):
    count = auto_escalate_old_tickets(db)
    summary = dashboard_stats(db, admin)
    per_day_rows = db.execute(
        select(func.date(Ticket.created_at), func.count(Ticket.id)).group_by(func.date(Ticket.created_at)).order_by(func.date(Ticket.created_at))
    ).all()
    activity_rows = db.execute(
        select(User.name, func.count(Ticket.id))
        .join(Ticket, Ticket.user_id == User.id)
        .group_by(User.id, User.name)
        .order_by(func.count(Ticket.id).desc())
        .limit(5)
    ).all()

    return DashboardAnalyticsOut(
        summary=summary,
        tickets_per_day=[{"label": str(row[0]), "value": row[1]} for row in per_day_rows],
        status_distribution=[
            {"label": "Open", "value": summary.open_tickets},
            {"label": "In Progress", "value": summary.in_progress_tickets},
            {"label": "Closed", "value": summary.closed_tickets},
            {"label": "Cancelled", "value": summary.cancelled_tickets},
        ],
        priority_distribution=[
            {"label": "Urgent", "value": summary.urgent_tickets},
            {"label": "High", "value": summary.high_tickets},
            {"label": "Medium", "value": summary.medium_tickets},
            {"label": "Low", "value": summary.low_tickets},
        ],
        average_resolution_hours=calculate_average_resolution_hours(db),
        most_active_users=[{"label": row[0], "value": row[1]} for row in activity_rows],
    )

@router.get("/export")
def export_tickets_csv(db: Session = Depends(get_db), admin=Depends(require_admin)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "title", "priority", "status", "created_at", "updated_at", "user_id", "assigned_user_id"])
    for ticket in db.scalars(select(Ticket).order_by(Ticket.created_at.desc())).all():
        writer.writerow([ticket.id, ticket.title, ticket.priority.value, ticket.status.value, ticket.created_at, ticket.updated_at, ticket.user_id, ticket.assigned_user_id])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=tickets.csv"})