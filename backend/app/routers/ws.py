from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from jose import jwt, JWTError

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User
from app.core.websocket_manager import manager

router = APIRouter(tags=["WebSocket"])

def get_user_from_token(token: str):
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if not user_id:
            return None

        db = SessionLocal()
        try:
            user = db.scalar(select(User).where(User.id == int(user_id)))
            return user
        finally:
            db.close()
    except (JWTError, ValueError):
        return None

@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    token = websocket.query_params.get("token")

    if not token:
        await websocket.close(code=1008)
        return

    user = get_user_from_token(token)
    if not user:
        await websocket.close(code=1008)
        return

    await manager.connect(user.id, websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user.id, websocket)
    except Exception:
        manager.disconnect(user.id, websocket)
        await websocket.close()


