from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr
from app.models.ticket import Priority, Status

class AdminUserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AdminUserTicketsOut(BaseModel):
    id: int
    title: str
    description: str
    priority: Priority
    status: Status
    user_id: int
    assigned_user_id: int | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class UserTicketMapOut(BaseModel):
    user_id: int
    email: EmailStr
    ticket_id: int
    ticket_status: Status
    ticket_desc: str

class DashboardStatsOut(BaseModel):
    total_tickets: int
    open_tickets: int
    in_progress_tickets: int
    closed_tickets: int
    cancelled_tickets: int
    urgent_tickets: int
    high_tickets: int
    medium_tickets: int
    low_tickets: int