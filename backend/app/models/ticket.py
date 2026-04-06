from sqlalchemy import Integer, DateTime, ForeignKey, Index, String, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from datetime import datetime, timezone

from app.core.database import Base

class Priority(str, enum.Enum):
    urgent = "urgent"
    high = "high"
    medium = "medium"
    low = "low"

class Status(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    closed = "closed"
    cancelled = "cancelled"


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    priority: Mapped[Priority] = mapped_column(Enum(Priority), nullable=False)
    status: Mapped[Status] = mapped_column(Enum(Status), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), 
                                                 default=lambda: datetime.now(timezone.utc), 
                                                 nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reopened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reopen_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    user = relationship("User", back_populates="tickets", foreign_keys=[user_id])
    assigned_user = relationship("User", back_populates="assigned_tickets", foreign_keys=[assigned_user_id])
    comments = relationship("Comment", back_populates="ticket", cascade="all, delete-orphan")
    activities = relationship("TicketActivity", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketActivity.created_at.asc()")
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketAttachment.created_at.desc()")

    __table_args__ = (
        Index("ix_user_ticket_priority", "priority", "user_id"),
        Index("ix_user_ticket_status", "status","user_id"),
        Index("ix_ticket_assigned_user", "assigned_user_id"),
        Index("ix_ticket_created_status", "created_at", "status"),
        Index("ix_ticket_updated_status", "updated_at", "status"),
        Index("ix_ticket_title", "title"),
    )
