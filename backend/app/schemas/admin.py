from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr
from app.models.ticket import Priority, Status

class AdminUserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    model_config = ConfigDict(from_attributes=True)

class AdminUserTicketsOut(BaseModel):
    id: int
    title: str
    description: str
    priority: Priority
    status: Status
    user_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class UserTicketMapOut(BaseModel):
    user_id: int
    email: EmailStr
    ticket_id: int
    ticket_status: Status
    ticket_desc: str

