from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from app.models.ticket import Priority, Status
from app.schemas.comment import CommentOut

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
                            "priority": "medium", 
                            "status": "cancelled",
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
    creator_name: str | None = None
    assigned_user_name: str | None = None
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None
    reopened_at: datetime | None = None
    reopen_reason: str | None = None

    model_config = ConfigDict(from_attributes=True)

class TicketReopenIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)

class AttachmentOut(BaseModel):
    id: int
    original_name: str
    mime_type: str
    file_size: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ActivityOut(BaseModel):
    id: int
    action: str
    message: str
    actor_user_id: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TicketDetailOut(TicketOut):
    creator_name: str | None = None
    assigned_user_name: str | None = None
    attachments: list[AttachmentOut] = Field(default_factory=list)
    activities: list[ActivityOut] = Field(default_factory=list)
    comments: list[CommentOut] = Field(default_factory=list)

class DuplicateCheckOut(BaseModel):
    is_duplicate: bool
    message: str
    matches: list[TicketOut] = Field(default_factory=list)
