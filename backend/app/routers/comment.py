from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.response import success_response
from app.dependencies.auth import get_current_user
from app.schemas.comment import CommentCreate, CommentOut
from app.schemas.common import APIResponse
from app.services.comment_service import add_ticket_comment, list_ticket__comments

router = APIRouter(prefix="/tickets/{ticket_id}/comments", tags=["Comments"])

@router.post("", response_model=APIResponse)
async def create_comment(ticket_id: int, payload: CommentCreate, 
                db: Session = Depends(get_db), user=Depends(get_current_user)):
    comment = await add_ticket_comment(db, ticket_id, payload, user)
    return success_response("Comment added successfully", CommentOut.model_validate(comment).model_dump())
    

@router.get("", response_model=APIResponse)
def get_comments(ticket_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    comments = list_ticket__comments(db, ticket_id, user)
    return success_response("Comments fetched successfully", [CommentOut.model_validate(c).model_dump() for c in comments])

