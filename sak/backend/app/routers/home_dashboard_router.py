from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.api.auth import get_current_user
from app.db import get_session
from app.models.user import User
from app.services.home_dashboard import (
    build_home_dashboard_bundle,
    build_home_dashboard_partial,
)

router = APIRouter(prefix="/api/dashboard/home", tags=["dashboard-home"])


@router.get("/bundle")
def get_home_dashboard_bundle(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    try:
        return build_home_dashboard_bundle(session=session, current_user=current_user)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/partial")
def get_home_dashboard_partial(
    keys: str = Query(..., description="Bloques a refrescar separados por coma"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    try:
        requested_keys = [key.strip() for key in keys.split(",") if key.strip()]
        return build_home_dashboard_partial(
            session=session,
            current_user=current_user,
            keys=requested_keys,
        )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc
