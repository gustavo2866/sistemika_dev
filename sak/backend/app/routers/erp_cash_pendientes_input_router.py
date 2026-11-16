from datetime import date
from typing import Literal

from fastapi import Depends, File, Form, HTTPException, Query, UploadFile
from sqlmodel import Session

from app.api.auth import get_current_user
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.erp.cash_pendientes_input import ErpCashPendientesInput
from app.models.erp.empresa import ErpEmpresa
from app.models.user import User
from app.services.erp_cash_pendientes_import_service import (
    import_cash_pendientes_csv,
    parse_cash_pendientes_csv,
)
from app.services.erp_cash_pendientes_assignment_service import (
    assign_cash_accounts_to_pendientes,
)
from app.services.erp_cash_pendientes_projection_service import (
    get_pending_projection_detail,
)


erp_cash_pendientes_input_crud = GenericCRUD(ErpCashPendientesInput)

erp_cash_pendientes_input_router = create_generic_router(
    model=ErpCashPendientesInput,
    crud=erp_cash_pendientes_input_crud,
    prefix="/erp/cash/pendientes-input",
    tags=["erp-cash-pendientes-input"],
)


@erp_cash_pendientes_input_router.post("/assign-cash-accounts")
def assign_erp_cash_pendientes_accounts(
    erp_empresa_id: int | None = Query(default=None, gt=0),
    overwrite: bool = Query(default=False),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    del current_user
    return assign_cash_accounts_to_pendientes(
        session,
        erp_empresa_id=erp_empresa_id,
        overwrite=overwrite,
    )


@erp_cash_pendientes_input_router.get("/pending-projection/detail")
def get_erp_cash_pendientes_projection_detail(
    cuenta_cash_id: int = Query(..., gt=0),
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    session: Session = Depends(get_session),
):
    try:
        return get_pending_projection_detail(
            session,
            cuenta_cash_id=cuenta_cash_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@erp_cash_pendientes_input_router.post("/import")
async def import_erp_cash_pendientes_input(
    erp_empresa_id: int = Form(..., description="ID interno de ErpEmpresa"),
    mode: Literal["replace", "append"] = Form("replace"),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    file_name = str(file.filename or "").strip()
    if not file_name.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Debe seleccionar un archivo .csv")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo supera el máximo de 5 MB")

    try:
        return import_cash_pendientes_csv(
            session,
            content=content,
            file_name=file_name,
            erp_empresa_id=erp_empresa_id,
            uploaded_by=current_user.id,
            mode=mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@erp_cash_pendientes_input_router.post("/validate")
async def validate_erp_cash_pendientes_input(
    erp_empresa_id: int = Form(..., description="ID interno de ErpEmpresa"),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    del current_user
    empresa = session.get(ErpEmpresa, erp_empresa_id)
    if empresa is None or empresa.deleted_at is not None:
        raise HTTPException(status_code=400, detail="La empresa ERP indicada no existe")

    file_name = str(file.filename or "").strip()
    if not file_name.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Debe seleccionar un archivo .csv")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo supera el máximo de 5 MB")

    try:
        rows = parse_cash_pendientes_csv(content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "erp_empresa_id": erp_empresa_id,
        "empresa": empresa.empresa_nombre,
        "file_name": file_name,
        "rows_read": len(rows),
        "rows_valid": sum(bool(row["is_valid"]) for row in rows),
        "rows_invalid": sum(not bool(row["is_valid"]) for row in rows),
    }
