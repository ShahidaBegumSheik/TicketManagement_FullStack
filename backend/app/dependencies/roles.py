from fastapi import Depends, HTTPException, status

from app.dependencies.auth import get_current_user
from app.models.user import UserRole

def require_admin(user=Depends(get_current_user)):
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user

def require_end_user(user=Depends(get_current_user)):
    if user.role != UserRole.user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, 
                            detail="Only users can perform this action")
    return user

