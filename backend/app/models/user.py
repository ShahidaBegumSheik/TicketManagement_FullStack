from sqlalchemy import ForeignKey, Integer, String, DateTime, Enum, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"

class User(Base):

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default="user", nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)

    tickets = relationship("Ticket", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_role", "role"),
        Index("ix_users_email", "email")
    )


    
