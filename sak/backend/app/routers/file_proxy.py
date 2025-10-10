"""
Router para servir archivos desde Cloudinary (proxy)
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import cloudinary
import cloudinary.utils
import requests
import os

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/proxy/{public_id:path}")
async def proxy_cloudinary_file(public_id: str):
    """
    Proxy para servir archivos de Cloudinary
    
    Este endpoint actúa como intermediario para archivos que están en Cloudinary
    pero que requieren autenticación. El backend se autentica y sirve el archivo
    al frontend.
    
    Args:
        public_id: El public_id del archivo en Cloudinary (puede incluir carpetas)
    
    Returns:
        StreamingResponse con el archivo
    """
    try:
        # Generar URL autenticada con las credenciales del backend
        # Esto funciona porque el backend tiene las credenciales en el .env
        url_info = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type="raw",
            type="upload",
            secure=True,
            sign_url=True
        )
        
        authenticated_url = url_info[0]
        
        # Descargar el archivo desde Cloudinary
        response = requests.get(authenticated_url, stream=True)
        
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        elif response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Error obteniendo archivo de Cloudinary: {response.status_code}"
            )
        
        # Determinar el tipo de contenido
        content_type = response.headers.get('Content-Type', 'application/octet-stream')
        
        # Si es PDF, asegurarse de que se muestre en el navegador
        if public_id.lower().endswith('.pdf') or content_type == 'application/pdf':
            content_type = 'application/pdf'
        
        # Retornar el archivo como streaming response
        return StreamingResponse(
            response.iter_content(chunk_size=8192),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename={public_id.split('/')[-1]}"
            }
        )
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error de conexión con Cloudinary: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando archivo: {str(e)}"
        )
