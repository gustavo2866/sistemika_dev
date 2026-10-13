import json
import os
import tempfile
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.core.router import create_generic_router
from app.crud.nomina_licencia_crud import nomina_licencia_crud
from app.db import get_session
from app.models.nomina_licencia import NominaLicencia
from app.services.gcs_storage_service import storage_service


_NOMINA_LICENCIA_MAX_FILE_SIZE = 20 * 1024 * 1024
_NOMINA_LICENCIA_MAX_DOCUMENTOS = 20
_NOMINA_LICENCIA_ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".txt",
}


class NominaLicenciaDocumentoDeleteRequest(BaseModel):
    url: str = Field(..., min_length=1)


nomina_licencia_router = create_generic_router(
    model=NominaLicencia,
    crud=nomina_licencia_crud,
    prefix="/nomina-licencias",
    tags=["nomina-licencias"],
)


@nomina_licencia_router.post("/validar-cobertura", tags=["nomina-licencias"])
def validar_cobertura_nomina_licencia(
    payload: dict[str, Any],
    session: Session = Depends(get_session),
):
    """Prevalida un guardado para informar bloqueos o pedir confirmacion."""
    obj_id_raw = payload.get("id")
    try:
        obj_id = int(obj_id_raw) if obj_id_raw not in (None, "") else None
    except (TypeError, ValueError):
        obj_id = None
    try:
        return nomina_licencia_crud.validar_guardado(
            session,
            payload,
            obj_id=obj_id,
        ).as_dict()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@nomina_licencia_router.post(
    "/{id:int}/validar-eliminacion",
    tags=["nomina-licencias"],
)
def validar_eliminacion_nomina_licencia(
    id: int,
    session: Session = Depends(get_session),
):
    try:
        return nomina_licencia_crud.validar_eliminacion(session, id).as_dict()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _get_nomina_licencia_or_404(id: int, session: Session) -> NominaLicencia:
    registro = session.get(NominaLicencia, id)
    if registro is None or registro.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Licencia de nómina no encontrada")
    return registro


def _parse_documento_item(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        url = str(value.get("url") or value.get("archivo_url") or "").strip()
        nombre = str(value.get("nombre") or "").strip() or Path(url).name or "Documento"
        return {
            "url": url,
            "nombre": nombre,
            "content_type": value.get("content_type") or value.get("mime_type"),
            "size": value.get("size") or value.get("tamanio_bytes"),
        }

    text = str(value or "").strip()
    if text.startswith("{"):
        try:
            parsed = json.loads(text)
        except ValueError:
            parsed = None
        if isinstance(parsed, dict):
            return _parse_documento_item(parsed)
    return {"url": text, "nombre": Path(text).name or "Documento"}


def _documentos_as_list(registro: NominaLicencia) -> list[dict[str, Any]]:
    return [
        item
        for item in (_parse_documento_item(value) for value in (registro.documentos or []))
        if item.get("url")
    ]


def _documentos_to_storage(items: list[dict[str, Any]]) -> list[str]:
    return [json.dumps(item, ensure_ascii=False) for item in items if item.get("url")]


@nomina_licencia_router.post("/{id:int}/documentos", tags=["nomina-licencias"])
async def upload_nomina_licencia_documento(
    id: int,
    file: UploadFile = File(...),
    nombre: str | None = Form(default=None),
    session: Session = Depends(get_session),
):
    registro = _get_nomina_licencia_or_404(id, session)
    documentos = _documentos_as_list(registro)
    if len(documentos) >= _NOMINA_LICENCIA_MAX_DOCUMENTOS:
        raise HTTPException(
            status_code=400,
            detail=f"Solo se permiten {_NOMINA_LICENCIA_MAX_DOCUMENTOS} documentos por licencia",
        )

    content = await file.read()
    if len(content) > _NOMINA_LICENCIA_MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande (máximo 20 MB)")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in _NOMINA_LICENCIA_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Tipo de archivo no permitido: {ext}")

    safe_name = f"{uuid.uuid4().hex}{ext}"
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(tmp_fd, "wb") as tmp:
            tmp.write(content)
        gcs_result = storage_service.upload_file(
            tmp_path,
            safe_name,
            folder=f"nomina-licencias/{id}",
            content_type=file.content_type,
        )
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    documentos.append(
        {
            "url": gcs_result["download_url"],
            "nombre": nombre or file.filename or safe_name,
            "content_type": file.content_type,
            "size": len(content),
        }
    )
    registro.documentos = _documentos_to_storage(documentos)
    registro.updated_at = datetime.now(UTC)
    session.add(registro)
    session.commit()
    session.refresh(registro)
    return registro


@nomina_licencia_router.delete("/{id:int}/documentos", tags=["nomina-licencias"])
def delete_nomina_licencia_documento(
    id: int,
    payload: NominaLicenciaDocumentoDeleteRequest,
    session: Session = Depends(get_session),
):
    registro = _get_nomina_licencia_or_404(id, session)
    documentos = _documentos_as_list(registro)
    remaining = [item for item in documentos if item.get("url") != payload.url]
    if len(remaining) == len(documentos):
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    try:
        blob_name = storage_service.blob_name_from_download_url(payload.url)
        storage_service.delete_file(blob_name)
    except Exception:
        # Un fallo al borrar el objeto no debe impedir que se quite la referencia.
        pass

    registro.documentos = _documentos_to_storage(remaining)
    registro.updated_at = datetime.now(UTC)
    session.add(registro)
    session.commit()
    session.refresh(registro)
    return registro
