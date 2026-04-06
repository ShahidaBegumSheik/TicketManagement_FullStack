from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationOut, NotificationListOut
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=NotificationListOut)
def get_notifications(db: Session = Depends(get_db), user=Depends(get_current_user)):
    stmt = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
    )
    notifications = db.scalars(stmt).all()

    unread_count = db.scalar(
        select(func.count(Notification.id))
               .select_from(Notification)
               .where(Notification.user_id == user.id, Notification.is_read.is_(False)) 
        ) or 0
    
    return {
        "items": notifications,
        "unread_count": unread_count,
    }

@router.post("/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")


    notification.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}

@router.post("/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    db.commit()
    return {"message": "All notifications marked as read"}


