"""
Router para servir archivos desde Google Cloud Storage (proxy)
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from app.services.gcs_storage_service import storage_service

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/proxy/{blob_path:path}")
async def proxy_gcs_file(blob_path: str):
    """
    Redirige a una URL firmada de GCS para evitar exponer credenciales al frontend.

    Args:
        blob_path: Ruta del objeto dentro del bucket o URI gs:// completa.
    """
    try:
        if blob_path.startswith("gs://"):
            blob_name = storage_service.blob_name_from_uri(blob_path)
        else:
            blob_name = blob_path

        signed_url = storage_service.generate_signed_url(blob_name)
        return RedirectResponse(url=signed_url, status_code=307)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Archivo no encontrado") from None
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error procesando archivo: {exc}") from exc

