import os
import uuid
from pathlib import Path
from typing import Dict

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
import aiofiles  # type: ignore

router = APIRouter()

# Configuración de upload
UPLOAD_DIR = Path("uploads")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

# Crear directorio de uploads si no existe
UPLOAD_DIR.mkdir(exist_ok=True)


def get_file_extension(filename: str) -> str:
    """Obtiene la extensión del archivo"""
    return Path(filename).suffix.lower()


def generate_unique_filename(original_filename: str) -> str:
    """Genera un nombre único para el archivo"""
    extension = get_file_extension(original_filename)
    unique_id = str(uuid.uuid4())
    return f"{unique_id}{extension}"


def validate_file(file: UploadFile) -> None:
    """Valida el archivo subido"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No se proporcionó un archivo")
    
    extension = get_file_extension(file.filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido. Extensiones permitidas: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Archivo muy grande. Tamaño máximo: {MAX_FILE_SIZE // 1024 // 1024}MB"
        )


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)) -> Dict[str, str]:
    """
    Endpoint para subir archivos de imagen
    """
    try:
        # Validar archivo
        validate_file(file)
        
        # Generar nombre único
        unique_filename = generate_unique_filename(file.filename)
        file_path = UPLOAD_DIR / unique_filename
        
        # Guardar archivo
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Construir URL del archivo
        # En desarrollo, la URL será relativa al servidor
        file_url = f"/uploads/{unique_filename}"
        
        return {
            "url": file_url,
            "filename": unique_filename
        }
        
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
