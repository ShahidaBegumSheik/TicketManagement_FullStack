from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from app.models.ticket import Priority, Status

class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=50)
    description: str | None = Field(min_length=1, max_length=255)
    priority: Priority = Priority.low

    model_config = ConfigDict(
        json_schema_extra={"example": {"title": "ticket1", 
                           "description": "login issue", 
                           "priority": "medium"}}
    )

class TicketUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = Field(default=None, min_length=1, max_length=255)
    priority: Priority | None = None
    status: Status | None = None
    assigned_user_id: int | None = None
    
    model_config = ConfigDict(
        json_schema_extra={"example": 
                           {"title": "ticket1",
                            "description": "ticket updated",
                            "priority": "medium", "status": "cancelled",
                            "assigned_user_id": 5,
                            }
        }
    )

class TicketOut(BaseModel):
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