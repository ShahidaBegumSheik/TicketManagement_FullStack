import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.roles import require_admin
from app.core.database import get_db
from app.core.cache import cache_get, cache_set

from app.models.ticket import Ticket, Priority, Status
from app.models.user import User, UserRole
from app.schemas.admin import AdminUserOut, DashboardAnalyticsOut, DashboardStatsOut
from app.schemas.ticket import (
    TicketOut, 
    TicketUpdate,
    BulkStatusUpdateIn,
    BulkAssignIn,
    BulkDeleteIn,
    BulkActionOut,
)
from app.services.notification_service import create_and_send_notification
from app.services.admin_service import ( 
    list_all_users,
    change_user_status,
    change_user_role,
    get_admin_ticket_stmt,
    update_ticket_by_admin_or_agent,
    get_dashboard_stats,
    get_dashboard_analytics,
    export_tickets_csv_content,
    soft_delete_ticket_by_admin,
    restore_ticket_by_admin,
    get_deleted_tickets_stmt,
    bulk_update_ticket_status,
    bulk_assign_tickets,
    bulk_soft_delete_tickets,
)
from app.services.ticketing import auto_escalate_old_tickets

from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import paginate

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/users", response_model=list[AdminUserOut])
def all_users(db: Session = Depends(get_db), admin = Depends(require_admin)):
    return list_all_users(db)


@router.patch("/users/{user_id}/status", response_model=AdminUserOut)
def toggle_user_status(user_id: int, is_active: bool, db: Session = Depends(get_db), admin=Depends(require_admin)):
    return change_user_status(db, user_id, is_active, admin)
    

@router.put("/users/{user_id}/role", response_model=AdminUserOut)
def update_user_role(user_id: int, role: UserRole, db: Session = Depends(get_db), admin=Depends(require_admin)):
    return change_user_role(db, user_id, role, admin)
    

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
    tag_names: list[str] | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=100),
):
    auto_escalate_old_tickets(db)

    cache_key = "admin:tickets:list:" + json.dumps(
        {
            "user_id": admin.id,
            "role": admin.role.value,
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

    stmt = get_admin_ticket_stmt(
        admin=admin,
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


@router.patch("/tickets/{ticket_id}", response_model=TicketOut)
async def update_ticket(ticket_id: int, payload: TicketUpdate,
                  db: Session = Depends(get_db),
                  actor=Depends(get_current_user)):
    return await update_ticket_by_admin_or_agent(db, ticket_id, payload, actor)
    

@router.get("/dashboard-stats", response_model=DashboardStatsOut)
async def dashboard_stats(db: Session = Depends(get_db), admin=Depends(require_admin)):
    cache_key = "dashboard:stats"

    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    
    result = get_dashboard_stats(db)
    cache_set(cache_key, result.model_dump(mode="json"))
    return result
    

@router.get("/dashboard-analytics", response_model=DashboardAnalyticsOut)
def dashboard_analytics(db: Session = Depends(get_db), admin=Depends(require_admin)):
    cache_key = "dashboard:analytics"

    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    
    result = get_dashboard_analytics(db)
    cache_set(cache_key, result.model_dump(mode="json"))
    return result

@router.get("/export")
def export_tickets_csv(db: Session = Depends(get_db), admin=Depends(require_admin)):
    csv_content = export_tickets_csv_content(db)
    return StreamingResponse(
        iter([csv_content]), 
        media_type="text/csv",
        headers={"Content-Disposition": "attachment ; filename=tickets.csv"},
    )
    
@router.get("/tickets/deleted", response_model=Page[TicketOut])
def deleted_tickets(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    stmt = get_deleted_tickets_stmt()
    return paginate(db, stmt)

@router.post("/tickets/{ticket_id}/restore", response_model=TicketOut)
def restore_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return restore_ticket_by_admin(db, ticket_id, admin)

@router.delete("/tickets/{ticket_id}", response_model=TicketOut)
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return soft_delete_ticket_by_admin(db, ticket_id, admin)


@router.patch("/tickets/bulk/status", response_model=BulkActionOut)
async def bulk_status_update(
    payload: BulkStatusUpdateIn,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return await bulk_update_ticket_status(
        db,
        ticket_ids=payload.ticket_ids,
        status=payload.status,
        actor=admin,
    )

@router.patch("/tickets/bulk/assign", response_model=BulkActionOut)
async def bulk_assign(
    payload: BulkAssignIn,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return await bulk_assign_tickets(
        db,
        ticket_ids=payload.ticket_ids,
        assigned_user_id=payload.assigned_user_id,
        actor=admin,
    )

@router.patch("/tickets/bulk/delete", response_model=BulkActionOut)
async def bulk_delete(
    payload: BulkDeleteIn,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return await bulk_soft_delete_tickets(
        db,
        ticket_ids=payload.ticket_ids,
        actor=admin,
        confirm=payload.confirm,
    )

