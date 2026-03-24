import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.dependencies.auth import get_current_user
from app.models.user import User, UserRole
from app.schemas.auth import LoginIn, RegisterIn, RegisterOut, TokenOut, UserMeOut, ProfileUpdateIn

router = APIRouter(prefix="/auth", tags=["Auth"])


def _issue_tokens(user: User) -> TokenOut:
    access = create_access_token(subject=str(user.id), extra={"role": user.role.value})
    return TokenOut(access_token=access, token_type="bearer")


def _authenticate(email: str, password: str, db: Session):
    normalized_email = email.lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    return user


@router.post("/register", response_model=RegisterOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
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


@router.post("/login", response_model=TokenOut)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = _authenticate(form_data.username, form_data.password, db)
    return _issue_tokens(user)


@router.post("/login-json", response_model=TokenOut)
def login_json(payload: LoginIn, db: Session = Depends(get_db)):
    user = _authenticate(payload.email, payload.password, db)
    return _issue_tokens(user)


@router.get("/me", response_model=UserMeOut)
def me(user=Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserMeOut)
def update_profile(
    payload: ProfileUpdateIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    normalized_email = payload.email.lower()
    existing = db.query(User).filter(User.email == normalized_email, User.id != user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")

    user.name = payload.name
    user.email = normalized_email
    db.commit()
    db.refresh(user)
    return user