from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.response import success_response
from app.dependencies.auth import get_current_user
from app.schemas.common import APIResponse
from app.schemas.filter import SavedFilterCreate, SavedFilterOut
from app.services.ticketing import (
    create_saved_filter,
    list_saved_filters,
    get_saved_filter_or_404,
    delete_saved_filter,
)

router = APIRouter(prefix="/filters", tags=["Saved Filters"])


@router.post("", response_model=APIResponse)
def create_filter(
    payload: SavedFilterCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    saved_filter = create_saved_filter(db, user.id, payload)
    return success_response("Saved filter created successfully", SavedFilterOut.model_validate(saved_filter).model_dump())


@router.get("", response_model=APIResponse)
def get_filters(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    items = list_saved_filters(db, user.id)
    return success_response(
        "Saved filters fetched successfully",
        [SavedFilterOut.model_validate(item).model_dump() for item in items],
    )


@router.get("/{filter_id}", response_model=APIResponse)
def get_filter(
    filter_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    item = get_saved_filter_or_404(db, filter_id, user.id)
    return success_response("Saved filter fetched successfully", SavedFilterOut.model_validate(item).model_dump())


@router.delete("/{filter_id}", response_model=APIResponse)
def remove_filter(
    filter_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    delete_saved_filter(db, filter_id, user.id)
    return success_response("Saved filter deleted successfully")

