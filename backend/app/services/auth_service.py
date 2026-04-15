import secrets

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.auth import RegisterIn, RegisterOut, TokenOut, ProfileUpdateIn

def issue_tokens(user: User) -> TokenOut:
    access = create_access_token(subject=str(user.id), extra={"role": user.role.value})
    return TokenOut(access_token=access, token_type="bearer")


def authenticate_user(email: str, password: str, db: Session):
    normalized_email = email.lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    return user

def register_user(db: Session, payload: RegisterIn) -> RegisterOut:
    normalized_email = payload.email.lower()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    token = secrets.token_urlsafe(32)
    user = User(
        name=payload.name,
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        role=UserRole.user,
        verification_token=token,
    )

    if settings.seed_admin and user.email == settings.admin_email.lower():
        user.role = UserRole.admin
        user.verification_token = None

    db.add(user)
    db.commit()
    db.refresh(user)

    return RegisterOut(
        message="Registration successful.",
        email=user.email,
        verification_token=token,
    )

def update_current_user_profile(db: Session, user: User, payload: ProfileUpdateIn) -> User:
    normalized_email = payload.email.lower()
    existing = db.query(User).filter(User.email == normalized_email, User.id != user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")

    user.name = payload.name
    user.email = normalized_email
    db.commit()
    db.refresh(user)
    return user