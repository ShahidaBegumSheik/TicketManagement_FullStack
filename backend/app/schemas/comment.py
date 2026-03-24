from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)

class CommentOut(BaseModel):
    id: int
    content: str
    ticket_id: int
    user_id: int
    user_name: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)