from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.api.auth import get_current_user
from app.db import get_session
from app.models.user import User
from app.services.home_dashboard import (
    build_home_dashboard_bundle,
    build_home_dashboard_context,
    build_home_dashboard_domain,
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


@router.get("/context")
def get_home_dashboard_context(
    current_user: User = Depends(get_current_user),
):
    try:
        return build_home_dashboard_context(current_user=current_user)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


def _get_home_dashboard_domain(
    domain: str,
    session: Session,
    current_user: User,
):
    try:
        return build_home_dashboard_domain(
            session=session,
            current_user=current_user,
            domain=domain,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Error inesperado") from exc


@router.get("/personal")
def get_home_dashboard_personal(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return _get_home_dashboard_domain("personal", session, current_user)


@router.get("/poorders")
def get_home_dashboard_poorders(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return _get_home_dashboard_domain("poorders", session, current_user)


@router.get("/oportunidades")
def get_home_dashboard_oportunidades(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return _get_home_dashboard_domain("oportunidades", session, current_user)


@router.get("/contratos")
def get_home_dashboard_contratos(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return _get_home_dashboard_domain("contratos", session, current_user)


@router.get("/propiedades")
def get_home_dashboard_propiedades(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return _get_home_dashboard_domain("propiedades", session, current_user)


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
