import mimetypes
import os
import tempfile
import uuid
from datetime import date, datetime, UTC
from pathlib import Path
from typing import Optional

from fastapi import Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.router import create_generic_router
from app.crud.contrato_crud import contrato_crud
from app.db import get_session
from app.models.contrato import Contrato
from app.models.contrato_archivo import ContratoArchivo
from app.services.gcs_storage_service import storage_service

# ── Upload config ─────────────────────────────────────────────────────────────

_CONTRATO_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
_CONTRATO_ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".txt",
}

contrato_router = create_generic_router(
    model=Contrato,
    crud=contrato_crud,
    prefix="/contratos",
    tags=["contratos"],
)

ESTADOS_TERMINALES = {"rescindido", "finalizado"}


def _get_contrato_or_404(id: int, session: Session) -> Contrato:
    contrato = session.get(Contrato, id)
    if not contrato or contrato.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return contrato


def _sync_propiedad_activar(contrato: "Contrato", session: Session) -> None:
    """Sincroniza los datos denormalizados de la propiedad al activar un contrato."""
    from app.models.propiedad import Propiedad
    propiedad = session.get(Propiedad, contrato.propiedad_id)
    if not propiedad:
        return
    propiedad.valor_alquiler = contrato.valor_alquiler
    propiedad.expensas = contrato.expensas
    propiedad.fecha_inicio_contrato = contrato.fecha_inicio
    propiedad.vencimiento_contrato = contrato.fecha_vencimiento
    propiedad.fecha_renovacion = contrato.fecha_renovacion
    propiedad.tipo_actualizacion_id = contrato.tipo_actualizacion_id
    propiedad.vacancia_activa = False
    propiedad.vacancia_fecha = None
    propiedad.updated_at = datetime.now(UTC)
    session.add(propiedad)


def _sync_propiedad_liberar(contrato: "Contrato", fecha_liberacion: date, session: Session) -> None:
    """Marca la propiedad como vacante al rescindir o finalizar un contrato."""
    from app.models.propiedad import Propiedad
    propiedad = session.get(Propiedad, contrato.propiedad_id)
    if not propiedad:
        return
    propiedad.vacancia_activa = True
    propiedad.vacancia_fecha = fecha_liberacion
    propiedad.updated_at = datetime.now(UTC)
    session.add(propiedad)


# --- Activar: borrador → vigente ---

@contrato_router.post("/{id}/activar", tags=["contratos"])
def activar_contrato(id: int, session: Session = Depends(get_session)):
    contrato = _get_contrato_or_404(id, session)

    if contrato.estado != "borrador":
        raise HTTPException(status_code=400, detail=f"Solo se puede activar un contrato en estado 'borrador'. Estado actual: '{contrato.estado}'")

    vigente_existente = session.exec(
        select(Contrato).where(
            Contrato.propiedad_id == contrato.propiedad_id,
            Contrato.estado == "vigente",
            Contrato.deleted_at == None,  # noqa: E711
        )
    ).first()
    if vigente_existente:
        raise HTTPException(
            status_code=409,
            detail=f"Ya existe un contrato vigente (id={vigente_existente.id}) para esta propiedad.",
        )

    contrato.estado = "vigente"
    contrato.updated_at = datetime.now(UTC)
    session.add(contrato)
    _sync_propiedad_activar(contrato, session)
    session.commit()
    session.refresh(contrato)
    return contrato


# --- Rescindir: vigente → rescindido (extinción anticipada) ---

class RescindirBody(BaseModel):
    fecha_rescision: date
    motivo_rescision: Optional[str] = None


@contrato_router.post("/{id}/rescindir", tags=["contratos"])
def rescindir_contrato(id: int, body: RescindirBody, session: Session = Depends(get_session)):
    contrato = _get_contrato_or_404(id, session)

    if contrato.estado != "vigente":
        raise HTTPException(status_code=400, detail=f"Solo se puede rescindir un contrato 'vigente'. Estado actual: '{contrato.estado}'")

    if body.fecha_rescision > date.today():
        raise HTTPException(status_code=400, detail="La fecha de rescisión no puede ser futura.")

    contrato.estado = "rescindido"
    contrato.fecha_rescision = body.fecha_rescision
    contrato.motivo_rescision = body.motivo_rescision
    contrato.updated_at = datetime.now(UTC)
    session.add(contrato)
    _sync_propiedad_liberar(contrato, body.fecha_rescision, session)
    session.commit()
    session.refresh(contrato)
    return contrato


# --- Finalizar: vigente → finalizado (fin natural del contrato) ---

@contrato_router.post("/{id}/finalizar", tags=["contratos"])
def finalizar_contrato(id: int, session: Session = Depends(get_session)):
    contrato = _get_contrato_or_404(id, session)

    if contrato.estado != "vigente":
        raise HTTPException(status_code=400, detail=f"Solo se puede finalizar un contrato 'vigente'. Estado actual: '{contrato.estado}'")

    contrato.estado = "finalizado"
    contrato.updated_at = datetime.now(UTC)
    session.add(contrato)
    _sync_propiedad_liberar(contrato, contrato.fecha_vencimiento or date.today(), session)
    session.commit()
    session.refresh(contrato)
    return contrato


# --- Renovar: vigente → finalizado + nuevo borrador ---

@contrato_router.post("/{id}/renovar", tags=["contratos"])
def renovar_contrato(id: int, session: Session = Depends(get_session)):
    contrato = _get_contrato_or_404(id, session)

    if contrato.estado != "vigente":
        raise HTTPException(
            status_code=400,
            detail=f"Solo se puede renovar un contrato 'vigente'. Estado actual: '{contrato.estado}'",
        )

    # Finalizar el contrato origen
    contrato.estado = "finalizado"
    contrato.updated_at = datetime.now(UTC)
    session.add(contrato)

    # Crear nuevo contrato en borrador copiando los datos base
    nuevo = Contrato(
        propiedad_id=contrato.propiedad_id,
        tipo_contrato_id=contrato.tipo_contrato_id,
        tipo_actualizacion_id=contrato.tipo_actualizacion_id,
        fecha_inicio=contrato.fecha_vencimiento,
        fecha_vencimiento=contrato.fecha_renovacion or contrato.fecha_vencimiento,
        duracion_meses=contrato.duracion_meses,
        valor_alquiler=contrato.valor_alquiler,
        expensas=contrato.expensas,
        deposito_garantia=contrato.deposito_garantia,
        moneda=contrato.moneda,
        inquilino_nombre=contrato.inquilino_nombre,
        inquilino_apellido=contrato.inquilino_apellido,
        inquilino_dni=contrato.inquilino_dni,
        inquilino_cuit=contrato.inquilino_cuit,
        inquilino_email=contrato.inquilino_email,
        inquilino_telefono=contrato.inquilino_telefono,
        inquilino_domicilio=contrato.inquilino_domicilio,
        garante1_nombre=contrato.garante1_nombre,
        garante1_apellido=contrato.garante1_apellido,
        garante1_dni=contrato.garante1_dni,
        garante1_cuit=contrato.garante1_cuit,
        garante1_email=contrato.garante1_email,
        garante1_telefono=contrato.garante1_telefono,
        garante1_domicilio=contrato.garante1_domicilio,
        garante1_tipo_garantia=contrato.garante1_tipo_garantia,
        garante2_nombre=contrato.garante2_nombre,
        garante2_apellido=contrato.garante2_apellido,
        garante2_dni=contrato.garante2_dni,
        garante2_cuit=contrato.garante2_cuit,
        garante2_email=contrato.garante2_email,
        garante2_telefono=contrato.garante2_telefono,
        garante2_domicilio=contrato.garante2_domicilio,
        garante2_tipo_garantia=contrato.garante2_tipo_garantia,
        lugar_celebracion=contrato.lugar_celebracion,
        estado="borrador",
        contrato_origen_id=contrato.id,
    )
    session.add(nuevo)
    session.flush()

    session.commit()
    session.refresh(nuevo)
    return {"contrato_original_id": contrato.id, "nuevo_contrato_id": nuevo.id, "nuevo_contrato": nuevo}


# --- Generar PDF: GET /contratos/{id}/pdf ---

@contrato_router.get("/{id}/pdf", tags=["contratos"])
def get_contrato_pdf(id: int, session: Session = Depends(get_session)):
    from app.services.contrato_pdf_service import build_contrato_pdf

    contrato = _get_contrato_or_404(id, session)

    # Forzar carga de relaciones antes de llamar al servicio PDF
    _ = contrato.propiedad
    if contrato.propiedad:
        _ = contrato.propiedad.propietario_ref
    _ = contrato.tipo_actualizacion

    tipo_contrato = getattr(contrato, "tipo_contrato", None)
    if tipo_contrato is None and contrato.tipo_contrato_id is not None:
        from app.models.tipo_contrato import TipoContrato
        tipo_contrato = session.get(TipoContrato, contrato.tipo_contrato_id)

    template = (tipo_contrato.template if tipo_contrato and tipo_contrato.template else None)
    if not template:
        raise HTTPException(
            status_code=422,
            detail="El tipo de contrato no tiene un template configurado. Asigne un template al tipo de contrato antes de generar el PDF.",
        )

    try:
        pdf_bytes = build_contrato_pdf(contrato, template)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {exc}") from exc

    filename = f"contrato_{id}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- Upload archivo: POST /contratos/{id}/archivos ---

@contrato_router.post("/{id}/archivos", tags=["contratos"])
async def upload_contrato_archivo(
    id: int,
    file: UploadFile = File(...),
    nombre: Optional[str] = Form(default=None),
    tipo: Optional[str] = Form(default=None),
    session: Session = Depends(get_session),
):
    _get_contrato_or_404(id, session)

    content = await file.read()

    if len(content) > _CONTRATO_MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande (máximo 20 MB)")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in _CONTRATO_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Tipo de archivo no permitido: {ext}")

    safe_name = f"{uuid.uuid4().hex}{ext}"

    # Escribir a archivo temporal y subir a GCS
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(tmp_fd, "wb") as tmp:
            tmp.write(content)
        gcs_result = storage_service.upload_file(
            tmp_path,
            safe_name,
            folder=f"contratos/{id}",
            content_type=file.content_type,
        )
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    archivo = ContratoArchivo(
        contrato_id=id,
        nombre=nombre or file.filename,
        tipo=tipo,
        archivo_url=gcs_result["download_url"],
        mime_type=file.content_type,
        tamanio_bytes=len(content),
    )
    session.add(archivo)
    session.commit()
    session.refresh(archivo)
    return archivo


# --- Eliminar archivo: DELETE /contratos/{id}/archivos/{archivo_id} ---

@contrato_router.delete("/{id}/archivos/{archivo_id}", tags=["contratos"])
def delete_contrato_archivo(
    id: int,
    archivo_id: int,
    session: Session = Depends(get_session),
):
    _get_contrato_or_404(id, session)

    archivo = session.get(ContratoArchivo, archivo_id)
    if not archivo or archivo.contrato_id != id:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    # Eliminar de GCS si la URL corresponde al bucket actual
    try:
        blob_name = storage_service.blob_name_from_download_url(archivo.archivo_url)
        storage_service.delete_file(blob_name)
    except (ValueError, Exception):
        pass  # Si falla la eliminación GCS no bloqueamos el registro

    session.delete(archivo)
    session.commit()
    return {"ok": True}
