"""
Servicio para gestionar uploads a Cloudinary
"""

import os
from pathlib import Path
import cloudinary
import cloudinary.uploader
from typing import Dict, Any

# Configurar Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)


class CloudinaryService:
    """Servicio para subir archivos a Cloudinary"""
    
    def upload_file(self, file_path: str, filename: str, folder: str = "sak_files") -> Dict[str, Any]:
        """
        Sube un archivo a Cloudinary
        
        Args:
            file_path: Ruta al archivo local
            filename: Nombre del archivo
            folder: Carpeta en Cloudinary (default: sak_files)
            
        Returns:
            Diccionario con información del archivo subido
        """
        try:
            # Detectar si es PDF
            file_extension = Path(file_path).suffix.lower()
            is_pdf = file_extension == '.pdf'
            
            # Para PDFs usar raw type para mantener el archivo intacto
            result = cloudinary.uploader.upload(
                file_path,
                folder=folder,
                public_id=Path(filename).stem,
                resource_type="raw" if is_pdf else "auto",
                type="upload",
                use_filename=True,
                unique_filename=True
            )
            
            return {
                "secure_url": result["secure_url"],
                "public_id": result["public_id"],
                "format": result.get("format", "pdf" if is_pdf else "unknown"),
                "bytes": result["bytes"],
                "width": result.get("width"),
                "height": result.get("height")
            }
        except Exception as e:
            raise Exception(f"Error subiendo archivo a Cloudinary: {str(e)}")
    
    def upload_invoice(self, file_path: str, filename: str) -> Dict[str, Any]:
        """
        Sube una factura a Cloudinary en la carpeta de facturas
        
        Args:
            file_path: Ruta al archivo local
            filename: Nombre del archivo
            
        Returns:
            Diccionario con información del archivo subido
        """
        return self.upload_file(file_path, filename, folder="sak_files/facturas")
    
    def get_signed_url(self, public_id: str, resource_type: str = "raw", expiration: int = 31536000) -> str:
        """
        Genera una URL firmada para acceder a un archivo
        
        Args:
            public_id: ID público del archivo en Cloudinary
            resource_type: Tipo de recurso (raw, image, video)
            expiration: Tiempo de expiración en segundos (default: 1 año)
            
        Returns:
            URL firmada para acceder al archivo
        """
        import cloudinary.utils
        signed_url = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type=resource_type,
            type="authenticated",
            sign_url=True,
            secure=True,
            expires_at=int(__import__('time').time()) + expiration
        )[0]
        return signed_url


# Instancia global del servicio
cloudinary_service = CloudinaryService()
