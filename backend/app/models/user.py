from sqlalchemy import Integer, String, DateTime, Enum, Index, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from datetime import datetime, timezone
import enum
from typing import List
from app.models.comment import Comment

class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"
    support_agent = "support_agent"

class User(Base):

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default="user", nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    tickets = relationship("Ticket", back_populates="user", cascade="all, delete-orphan", foreign_keys="Ticket.user_id")
    assigned_tickets = relationship(
        "Ticket",
        foreign_keys="Ticket.assigned_user_id",
        back_populates="assigned_user",
    )
    comment: Mapped[list["Comment"]] = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    saved_filters = relationship("SavedFilter", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_role", "role"),
        Index("ix_users_email", "email"),
        Index("ix_users_is_active", "is_active")
    )


    
