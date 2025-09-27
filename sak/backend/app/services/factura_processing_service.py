"""
Servicio basico de procesamiento de facturas
Version inicial que maneja la logica de negocio sin OCR/LLM
"""

import os
import logging
from typing import Dict, Any
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class FacturaProcessingService:
    """Servicio para procesamiento de facturas"""

    def __init__(self) -> None:
        self.uploads_dir = Path("uploads/facturas")
        self.uploads_dir.mkdir(parents=True, exist_ok=True)

    async def process_uploaded_pdf(
        self,
        file_path: str,
        original_filename: str,
        proveedor_id: int,
        tipo_operacion_id: int,
    ) -> Dict[str, Any]:
        """Procesa un PDF de factura subido"""

        logger.info("Procesando factura: %s", original_filename)

        stored_name = Path(file_path).name

        template_data = {
            "numero": "",
            "punto_venta": "",
            "tipo_comprobante": "B",
            "fecha_emision": datetime.now().date().isoformat(),
            "fecha_vencimiento": None,
            "subtotal": 0.0,
            "total_impuestos": 0.0,
            "total": 0.0,
            "estado": "pendiente",
            "observaciones": f"Procesado desde: {original_filename}",
            "nombre_archivo_pdf": original_filename,
            "nombre_archivo_pdf_guardado": stored_name,
            "ruta_archivo_pdf": file_path,
            "stored_filename": stored_name,
            "comprobante_id": None,
            "proveedor_id": proveedor_id,
            "tipo_operacion_id": tipo_operacion_id,
        }

        return template_data

    async def save_factura_data(self, factura_data: Dict[str, Any]) -> int:
        """Guarda los datos de la factura en la base de datos"""

        logger.info("Guardando factura: %s", factura_data.get("numero", "Sin numero"))
        return 1

    def get_supported_file_types(self) -> list[str]:
        return [".pdf"]

    def validate_file(self, file_path: str) -> bool:
        file_ext = Path(file_path).suffix.lower()
        return file_ext in self.get_supported_file_types()

    async def extract_basic_info(self, file_path: str, original_filename: str | None = None) -> Dict[str, Any]:
        stored_name = Path(file_path).name
        file_info = {
            "file_size": os.path.getsize(file_path),
            "file_name": original_filename or stored_name,
            "file_extension": Path(file_path).suffix,
            "upload_timestamp": datetime.now().isoformat(),
            "nombre_archivo_pdf": original_filename or stored_name,
            "nombre_archivo_pdf_guardado": stored_name,
            "ruta_archivo_pdf": file_path,
            "stored_filename": stored_name,
        }
        return file_info
