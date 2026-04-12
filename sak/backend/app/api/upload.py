import mimetypes
import os
import uuid
from pathlib import Path
from typing import Dict, Optional, Set

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
import aiofiles  # type: ignore

router = APIRouter()

# Configuración de upload
UPLOAD_DIR = Path("uploads")
IMAGES_DIR = UPLOAD_DIR / "images"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

DOC_ALLOWED_EXTENSIONS: Set[str] = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".txt",
}
DOC_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# Crear directorios de uploads si no existen
UPLOAD_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)


def get_file_extension(filename: str) -> str:
    """Obtiene la extensión del archivo"""
    return Path(filename).suffix.lower()


def generate_unique_filename(original_filename: str) -> str:
    """Genera un nombre único para el archivo"""
    extension = get_file_extension(original_filename)
    unique_id = str(uuid.uuid4())
    return f"{unique_id}{extension}"


def validate_file(
    file: UploadFile,
    allowed_extensions: Optional[Set[str]] = None,
    max_size: int = MAX_FILE_SIZE,
) -> None:
    """Valida el archivo subido"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No se proporcionó un archivo")

    extension = get_file_extension(file.filename)
    effective_extensions = allowed_extensions if allowed_extensions is not None else ALLOWED_EXTENSIONS
    if extension not in effective_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Extensiones permitidas: {', '.join(sorted(effective_extensions))}"
        )

    if file.size and file.size > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"Archivo muy grande. Tamaño máximo: {max_size // 1024 // 1024}MB"
        )


async def save_upload(
    file: UploadFile,
    subdir: str,
    allowed_extensions: Optional[Set[str]] = None,
    max_size: int = MAX_FILE_SIZE,
) -> Dict[str, str]:
    """
    Valida, guarda el archivo en uploads/<subdir>/ y devuelve
    {"url": "/uploads/<subdir>/<uuid><ext>", "filename": "<uuid><ext>", "mime_type": "...", "size": ...}.
    """
    validate_file(file, allowed_extensions=allowed_extensions, max_size=max_size)

    dest_dir = UPLOAD_DIR / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)

    unique_filename = generate_unique_filename(file.filename)  # type: ignore[arg-type]
    file_path = dest_dir / unique_filename

    content = await file.read()
    # Double-check size after reading (file.size is not always set)
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"Archivo muy grande. Tamaño máximo: {max_size // 1024 // 1024}MB",
        )

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    mime_type = file.content_type or (mimetypes.guess_type(file.filename)[0] or "application/octet-stream")

    return {
        "url": f"/uploads/{subdir}/{unique_filename}",
        "filename": unique_filename,
        "mime_type": mime_type,
        "size": str(len(content)),
    }


def delete_upload(url: str) -> None:
    """
    Elimina el archivo físico que corresponde a la URL relativa /uploads/... .
    No lanza excepción si el archivo no existe.
    """
    if not url:
        return
    try:
        # url tiene forma /uploads/subdir/filename
        relative = Path(url.lstrip("/"))
        file_path = Path(relative)
        resolved = file_path.resolve()
        uploads_resolved = UPLOAD_DIR.resolve()
        resolved.relative_to(uploads_resolved)  # seguridad: dentro de uploads/
        if file_path.exists():
            file_path.unlink()
    except Exception:
        pass


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)) -> Dict[str, str]:
    """
    Endpoint para subir archivos de imagen
    """
    try:
        result = await save_upload(file, subdir="images")
        return {"url": result["url"], "filename": result["filename"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir archivo: {str(e)}")


@router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """
    Endpoint para servir archivos subidos
    """
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    # Verificar que el archivo esté dentro del directorio de uploads (seguridad)
    try:
        file_path.resolve().relative_to(UPLOAD_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    
    from fastapi.responses import FileResponse
    return FileResponse(file_path)
