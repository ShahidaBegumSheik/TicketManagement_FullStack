from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from app.models.ticket import Priority, Status
from app.schemas.comment import CommentOut

class TagOut(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)
class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=50)
    description: str | None = Field(min_length=1, max_length=255)
    priority: Priority = Priority.low
    tags: list[str] = Field(default_factory=list)

    model_config = ConfigDict(
        json_schema_extra={"example": {"title": "ticket1", 
                           "description": "login issue", 
                           "priority": "low"}}
    )

class TicketUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = Field(default=None, min_length=1, max_length=255)
    priority: Priority | None = None
    status: Status | None = None
    assigned_user_id: int | None = None
    tags: list[str] | None = None
    
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
    tags: list[TagOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None
    reopened_at: datetime | None = None
    reopen_reason: str | None = None
    is_deleted: bool = False
    deleted_at: datetime | None = None
    deleted_by_user_id: int | None = None

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


class BulkStatusUpdateIn(BaseModel):
    ticket_ids: list[int] = Field(min_length=1)
    status: Status

class BulkAssignIn(BaseModel):
    ticket_ids: list[int] = Field(min_length=1)
    assigned_user_id: int | None

class BulkDeleteIn(BaseModel):
    ticket_ids: list[int] = Field(min_length=1)
    confirm: bool = False

class BulkActionOut(BaseModel):
    message: str
    updated_count: int
    ticket_ids: list[int]


