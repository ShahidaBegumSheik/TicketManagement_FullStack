from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    is_active: bool
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

