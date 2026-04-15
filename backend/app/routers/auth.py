from fastapi import APIRouter, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.schemas.auth import LoginIn, RegisterIn, RegisterOut, TokenOut, UserMeOut, ProfileUpdateIn
from app.services.auth_service import (
    issue_tokens,
    authenticate_user,
    register_user,
    update_current_user_profile,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
limiter = Limiter(key_func=get_remote_address)

@router.post("/register", response_model=RegisterOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):  
    return register_user(db, payload)

@router.post("/login", response_model=TokenOut)
@limiter.limit(settings.rate_limit_login)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db) # request is required by slowapi rate limiter
):
    user = authenticate_user(form_data.username, form_data.password, db)
    return issue_tokens(user)

@router.post("/login-json", response_model=TokenOut)
@limiter.limit(settings.rate_limit_login)
def login_json(request: Request, payload: LoginIn, db: Session = Depends(get_db)):
    user = authenticate_user(payload.email, payload.password, db)
    return issue_tokens(user)


@router.get("/me", response_model=UserMeOut)
def me(user=Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserMeOut)
def update_profile(payload: ProfileUpdateIn,
                   db: Session = Depends(get_db),
                   user=Depends(get_current_user),
):
    return update_current_user_profile(db, user, payload)
    