from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    ticket_id: int | None = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class NotificationListOut(BaseModel):
    items: list[NotificationOut] = Field(default_factory=list)
    unread_count: int
