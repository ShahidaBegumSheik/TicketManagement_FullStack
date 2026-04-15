from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.ticket import Priority, Status


class SavedFilterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    status: Status | None = None
    priority: Priority | None = None
    assigned_user_id: int | None = None
    tag_names: list[str] = Field(default_factory=list)
    search: str | None = None
    from_date: str | None = None
    to_date: str | None = None


class SavedFilterOut(BaseModel):
    id: int
    name: str = Field(min_length=1, max_length=100)
    user_id: int
    filter_config: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

