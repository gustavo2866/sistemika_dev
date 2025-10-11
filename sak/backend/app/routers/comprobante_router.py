from fastapi import APIRouter, HTTPException, Depends
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path

from app.models.comprobante import Comprobante
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from sqlmodel import Session
from app.services.gcs_storage_service import storage_service


# CRUD genérico
comprobante_crud = GenericCRUD(Comprobante)

# Router genérico REST
comprobante_router = create_generic_router(
    model=Comprobante,
    crud=comprobante_crud,
    prefix="/comprobantes",
    tags=["comprobantes"],
)


# Endpoint adicional para servir archivo del comprobante
file_router = APIRouter(prefix="/comprobantes", tags=["comprobantes"])


@file_router.get("/{comprobante_id}/file")
async def get_comprobante_file(comprobante_id: int, session: Session = Depends(get_session)):
    comp = comprobante_crud.get(session, comprobante_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")
    if not comp.archivo_ruta:
        raise HTTPException(status_code=404, detail="Comprobante sin archivo asociado")

    if comp.archivo_ruta.startswith("gs://"):
        try:
            blob_name = storage_service.blob_name_from_uri(comp.archivo_ruta)
            signed_url = storage_service.generate_signed_url(blob_name)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Archivo no encontrado en almacenamiento") from None
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Error obteniendo archivo: {exc}") from exc

        return RedirectResponse(url=signed_url, status_code=307)

    path = Path(comp.archivo_ruta)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado en disco")

    # Inferir content-type simple por extensión
    media_type = "application/pdf" if path.suffix.lower() == ".pdf" else "application/octet-stream"
    return FileResponse(path, media_type=media_type, filename=path.name)
