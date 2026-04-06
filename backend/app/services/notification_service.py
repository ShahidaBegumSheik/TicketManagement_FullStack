from sqlalchemy.orm import Session
from app.core.config import settings

from app.models.notification import Notification
from app.models.user import User
from app.core.websocket_manager import manager
from email.mime.text import MIMEText
import smtplib
import logging

logger = logging.getLogger(__name__)

async def create_and_send_notification(
        db: Session,
        *,
        user_id: int,
        title: str,
        message: str,
        ticket_id: int | None = None,
):
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        ticket_id=ticket_id,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    await manager.send_to_user(
        user_id,
        {
            "type": "notification",
            "data": {
                "id": notification.id,
                "title": notification.title,
                "message": notification.message,
                "ticket_id": notification.ticket_id,
                "is_read": notification.is_read,
                "created_at": notification.created_at.isoformat(),
            },
        },
    )
    recipient = db.get(User, user_id)
    if recipient and recipient.email:
        try:
            _maybe_send_email(
                to_email=recipient.email,
                subject=title,
                message=message,
            )
        except Exception as exc:
            logger.exception(
                "Failed to send email notification to user_id=%s email=%s",
                user_id,
                recipient.email,
            )


    return notification
    
def _maybe_send_email(to_email: str | None, subject: str, message: str) -> None:
    if not to_email or not settings.smtp_host or not settings.smtp_from_email:
        return
    mime = MIMEText(message)
    mime["Subject"] = subject
    mime["From"] = settings.smtp_from_email
    mime["To"] = to_email
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(mime)