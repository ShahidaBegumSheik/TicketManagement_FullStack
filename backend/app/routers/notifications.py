from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.response import success_response
from app.schemas.notification import NotificationOut, NotificationListOut
from app.dependencies.auth import get_current_user
from app.schemas.common import APIResponse
from app.services.notification_service import (
    get_user_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=APIResponse)
def list_notifications(db: Session = Depends(get_db), user=Depends(get_current_user)):
    result = get_user_notifications(db, user.id)
    return success_response("Notifications fetched successfully", result)
    

@router.patch("/{notification_id}/read", response_model=APIResponse)
def read_notification(notification_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    result = mark_notification_read(db, notification_id, user.id)
    return success_response(result["message"], None)
    

@router.patch("/read-all", response_model=APIResponse)
def read_all_notifications(db: Session = Depends(get_db), user=Depends(get_current_user)):
    result = mark_all_notifications_read(db, user.id)
    return success_response(result["message"], None)
    


