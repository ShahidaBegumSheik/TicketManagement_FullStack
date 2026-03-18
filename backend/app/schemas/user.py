from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr

    model_config = ConfigDict(from_attributes=True)

