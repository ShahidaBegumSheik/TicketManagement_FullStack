from pydantic import BaseModel, ConfigDict, EmailStr, Field

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class RegisterOut(BaseModel):
    message: str
    email: EmailStr
    verification_token: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserMeOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class ProfileUpdateIn(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    email: EmailStr