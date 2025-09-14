"""
Servicio básico de procesamiento de facturas
Versión inicial que maneja la lógica de negocio sin OCR/LLM
"""

import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from app.models.factura import Factura
from app.models.proveedor import Proveedor
from app.models.tipo_operacion import TipoOperacion
from app.models.factura_detalle import FacturaDetalle
from app.models.factura_impuesto import FacturaImpuesto

logger = logging.getLogger(__name__)

class FacturaProcessingService:
    """Servicio para procesamiento de facturas"""
    
    def __init__(self):
        self.uploads_dir = Path("uploads/facturas")
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
    
    async def process_uploaded_pdf(
        self, 
        file_path: str, 
        original_filename: str,
        proveedor_id: int,
        tipo_operacion_id: int
    ) -> Dict[str, Any]:
        """
        Procesa un PDF de factura subido
        
        Args:
            file_path: Ruta del archivo subido
            original_filename: Nombre original del archivo
            proveedor_id: ID del proveedor
            tipo_operacion_id: ID del tipo de operación
            
        Returns:
            Dict con datos extraídos o template para completar manualmente
        """
        logger.info(f"Procesando factura: {original_filename}")
        
        # Por ahora retornamos un template básico
        # En el futuro aquí se integrará el PDFExtractionService
        
        template_data = {
            "numero": "",
            "punto_venta": "",
            "tipo_comprobante": "B",
            "fecha_emision": datetime.now().date().isoformat(),
            "fecha_vencimiento": None,
            "subtotal": 0.0,
            "total_impuestos": 0.0,
            "total": 0.0,
            "observaciones": f"Procesado desde: {original_filename}",
            "nombre_archivo_pdf": original_filename,
            "ruta_archivo_pdf": file_path,
            "extraido_por_ocr": False,
            "extraido_por_llm": False,
            "confianza_extraccion": 0.0,
            "proveedor_id": proveedor_id,
            "tipo_operacion_id": tipo_operacion_id,
            "estado": "pendiente"
        }
        
        return template_data
    
    async def save_factura_data(self, factura_data: Dict[str, Any]) -> int:
        """
        Guarda los datos de la factura en la base de datos
        
        Args:
            factura_data: Datos de la factura a guardar
            
        Returns:
            ID de la factura creada
        """
        # Esta función se implementará cuando tengamos la base de datos configurada
        # Por ahora solo loggeamos
        logger.info(f"Guardando factura: {factura_data.get('numero', 'Sin número')}")
        
        # TODO: Implementar guardado en BD usando GenericCRUD
        # factura_crud = GenericCRUD(Factura)
        # nueva_factura = await factura_crud.create(factura_data)
        # return nueva_factura.id
        
        return 1  # ID mock
    
    def get_supported_file_types(self) -> list:
        """Retorna los tipos de archivo soportados"""
        return [".pdf"]
    
    def validate_file(self, file_path: str) -> bool:
        """Valida que el archivo sea del tipo correcto"""
        file_ext = Path(file_path).suffix.lower()
        return file_ext in self.get_supported_file_types()
    
    async def extract_basic_info(self, file_path: str) -> Dict[str, Any]:
        """
        Extrae información básica del archivo sin OCR
        
        Args:
            file_path: Ruta al archivo
            
        Returns:
            Información básica extraída
        """
        file_info = {
            "file_size": os.path.getsize(file_path),
            "file_name": Path(file_path).name,
            "file_extension": Path(file_path).suffix,
            "upload_timestamp": datetime.now().isoformat()
        }
        
        # Aquí se podría agregar lógica básica de extracción de metadatos
        
        return file_info
