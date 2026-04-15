import csv
import io
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.models.ticket import Ticket, Priority, Status
from app.models.user import User, UserRole
from app.schemas.admin import DashboardAnalyticsOut, DashboardStatsOut
from app.schemas.ticket import TicketOut, TicketUpdate
from app.services.notification_service import create_and_send_notification
from app.services.ticketing import ( 
    calculate_average_resolution_hours, 
    create_ticket_activity,
    auto_escalate_old_tickets,
    set_ticket_tags,
    get_ticket_search_stmt,
    invalidate_ticket_caches,
)

def list_all_users(db: Session):
    stmt = select(User).order_by(User.id)
    return list(db.scalars(stmt).all())

def change_user_status(db: Session, user_id: int, is_active: bool, admin: User):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and not is_active:
        raise HTTPException(status_code=400, detail="Admin cannot deactivate own account")
    
    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user

def change_user_role(db: Session, user_id: int, role: UserRole, admin: User):
    user = db.get(User, user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    
    if user.role == UserRole.admin:
        raise HTTPException(status_code=400, detail="Admin role cannot be changed")
    
    user.role = role
    db.commit()
    db.refresh(user)
    return user

def get_admin_ticket_stmt(
        *,
        admin: User,
        status: Status | None,
        priority: Priority | None,
        search: str | None,
        assigned_user_id: int | None,
        from_date: str | None,
        to_date: str | None,
        tag_names: list[str] | None,
):
    return get_ticket_search_stmt(
        user=admin,
        status=status,
        priority=priority,
        search=search,
        assigned_user_id=assigned_user_id,
        from_date=from_date,
        to_date=to_date,
        tag_names=tag_names,
    )

async def update_ticket_by_admin_or_agent(db: Session, ticket_id: int, payload, actor=User):
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

            if ticket.status == Status.open:
                ticket.status = Status.in_progress
    if payload.tags is not None:
        set_ticket_tags(db, ticket, payload.tags)

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
    invalidate_ticket_caches()
    return ticket

def get_dashboard_stats(db: Session) -> DashboardStatsOut:
    total_tickets = db.scalar(select(func.count(Ticket.id)).where(Ticket.is_deleted.is_(False))) or 0
    
    status_rows = db.execute(
        select(Ticket.status, func.count(Ticket.id))
        .where(Ticket.is_deleted.is_(False))
        .group_by(Ticket.status)
    ).all()

    priority_rows = db.execute(
        select(Ticket.priority, func.count(Ticket.id))
        .where(Ticket.is_deleted.is_(False))
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

def get_dashboard_analytics(db: Session) -> DashboardAnalyticsOut:
    auto_escalate_old_tickets(db)
    summary = get_dashboard_stats(db)
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

def export_tickets_csv_content(db: Session) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "title", "priority", "status", "created_at", "updated_at", "user_id", "assigned_user_id"])

    tickets = db.scalars(
        select(Ticket)
        .where(Ticket.is_deleted.is_(False))
        .order_by(Ticket.created_at.desc())
        ).all()
    
    for ticket in tickets:
        writer.writerow([
            ticket.id, 
            ticket.title, 
            ticket.priority.value, 
            ticket.status.value, 
            ticket.created_at, 
            ticket.updated_at, 
            ticket.user_id, 
            ticket.assigned_user_id,
        ])
    output.seek(0)
    
    return output.getvalue()

def soft_delete_ticket(db: Session, ticket: Ticket, actor: User) -> None:
    ticket.is_deleted = True
    ticket.deleted_at = datetime.now(timezone.utc)
    ticket.deleted_by_user_id = actor.id


def soft_delete_ticket_by_admin(db: Session, ticket_id: int, admin: User):
    ticket = db.get(Ticket, ticket_id)
    if not ticket or ticket.is_deleted:
        raise HTTPException(status_code=404, detail="Ticket not found")

    soft_delete_ticket(db, ticket, admin)
    create_ticket_activity(
        db,
        ticket.id,
        admin.id,
        "ticket_deleted",
        f"Ticket soft deleted by {admin.name}.",
    )
    db.commit()
    db.refresh(ticket)
    invalidate_ticket_caches()

    return ticket


def restore_ticket_by_admin(db: Session, ticket_id: int, admin: User) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if not ticket or not ticket.is_deleted:
        raise HTTPException(status_code=404, detail="Deleted ticket not found")

    ticket.is_deleted = False
    ticket.deleted_at = None
    ticket.deleted_by_user_id = None

    create_ticket_activity(
        db,
        ticket.id,
        admin.id,
        "ticket_restored",
        f"Ticket restored by {admin.name}.",
    )
    db.commit()
    db.refresh(ticket)
    invalidate_ticket_caches()

    return ticket


def get_deleted_tickets_stmt():
    return (
        select(Ticket)
        .where(Ticket.is_deleted.is_(True))
        .order_by(Ticket.deleted_at.desc(), Ticket.updated_at.desc())
    )


async def bulk_update_ticket_status(
    db: Session,
    ticket_ids: list[int],
    status: Status,
    actor: User,
):
    tickets = list(
        db.scalars(
            select(Ticket).where(
                Ticket.id.in_(ticket_ids),
                Ticket.is_deleted.is_(False),
            )
        ).all()
    )

    if not tickets:
        raise HTTPException(status_code=404, detail="No matching tickets found")

    for ticket in tickets:
        previous_status = ticket.status
        ticket.status = status

        if status == Status.closed:
            ticket.closed_at = datetime.now(timezone.utc)
        elif previous_status == Status.closed and status != Status.closed:
            ticket.closed_at = None

        create_ticket_activity(
            db,
            ticket.id,
            actor.id,
            "bulk_status_updated",
            f"Status changed from {previous_status.value} to {status.value} by {actor.name} (bulk action).",
        )

        await create_and_send_notification(
            db,
            user_id=ticket.user_id,
            title="Ticket status updated",
            message=f"Ticket #{ticket.id} status changed to {status.value} by {actor.name}.",
            ticket_id=ticket.id,
        )

        if ticket.assigned_user_id and ticket.assigned_user_id != actor.id:
            await create_and_send_notification(
                db,
                user_id=ticket.assigned_user_id,
                title="Assigned ticket updated",
                message=f"Ticket #{ticket.id} status changed to {status.value}.",
                ticket_id=ticket.id,
            )

    db.commit()
    invalidate_ticket_caches()

    return {
        "message": "Bulk status update completed",
        "updated_count": len(tickets),
        "ticket_ids": [ticket.id for ticket in tickets],
    }


async def bulk_assign_tickets(
    db: Session,
    ticket_ids: list[int],
    assigned_user_id: int | None,
    actor: User,
):
    tickets = list(
        db.scalars(
            select(Ticket).where(
                Ticket.id.in_(ticket_ids),
                Ticket.is_deleted.is_(False),
            )
        ).all()
    )

    if not tickets:
        raise HTTPException(status_code=404, detail="No matching tickets found")

    assignee = None
    if assigned_user_id is not None:
        assignee = db.get(User, assigned_user_id)
        if not assignee:
            raise HTTPException(status_code=404, detail="Assigned user not found")
        if assignee.role not in {UserRole.support_agent, UserRole.admin}:
            raise HTTPException(
                status_code=400,
                detail="Ticket can only be assigned to admin or support agent",
            )
        if not assignee.is_active:
            raise HTTPException(
                status_code=400,
                detail="Cannot assign ticket to inactive user",
            )

    for ticket in tickets:
        ticket.assigned_user_id = assigned_user_id

        if ticket.status == Status.open and assigned_user_id is not None:
            ticket.status = Status.in_progress

        assignee_name = assignee.name if assignee else "Unassigned"

        create_ticket_activity(
            db,
            ticket.id,
            actor.id,
            "bulk_ticket_assigned",
            f"Ticket assigned to {assignee_name} by {actor.name} (bulk action).",
        )

        await create_and_send_notification(
            db,
            user_id=ticket.user_id,
            title="Ticket assignment updated",
            message=f"Ticket #{ticket.id} was assigned by {actor.name}.",
            ticket_id=ticket.id,
        )

        if assigned_user_id and assigned_user_id != actor.id:
            await create_and_send_notification(
                db,
                user_id=assigned_user_id,
                title="Ticket assigned",
                message=f"You were assigned ticket #{ticket.id}.",
                ticket_id=ticket.id,
            )

    db.commit()
    invalidate_ticket_caches()

    return {
        "message": "Bulk assign completed",
        "updated_count": len(tickets),
        "ticket_ids": [ticket.id for ticket in tickets],
    }


async def bulk_soft_delete_tickets(
    db: Session,
    ticket_ids: list[int],
    actor: User,
    confirm: bool,
):
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Confirmation required for bulk delete",
        )

    tickets = list(
        db.scalars(
            select(Ticket).where(
                Ticket.id.in_(ticket_ids),
                Ticket.is_deleted.is_(False),
            )
        ).all()
    )

    if not tickets:
        raise HTTPException(status_code=404, detail="No matching tickets found")

    for ticket in tickets:
        soft_delete_ticket(db, ticket, actor)

        create_ticket_activity(
            db,
            ticket.id,
            actor.id,
            "bulk_ticket_deleted",
            f"Ticket soft deleted by {actor.name} (bulk action).",
        )

        await create_and_send_notification(
            db,
            user_id=ticket.user_id,
            title="Ticket deleted",
            message=f"Ticket #{ticket.id} was deleted by {actor.name}.",
            ticket_id=ticket.id,
        )

        if ticket.assigned_user_id and ticket.assigned_user_id != actor.id:
            await create_and_send_notification(
                db,
                user_id=ticket.assigned_user_id,
                title="Assigned ticket deleted",
                message=f"Ticket #{ticket.id} was deleted by {actor.name}.",
                ticket_id=ticket.id,
            )

    db.commit()
    invalidate_ticket_caches()

    return {
        "message": "Bulk delete completed",
        "updated_count": len(tickets),
        "ticket_ids": [ticket.id for ticket in tickets],
    }

