"""
Router para procesamiento de facturas con extracción de PDFs
"""

import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse

from app.services.factura_processing_service import FacturaProcessingService
from app.db import get_session
from sqlmodel import Session
from app.models.factura_extraccion import FacturaExtraccion

router = APIRouter(prefix="/facturas", tags=["facturas-procesamiento"])

# Instancia del servicio
factura_service = FacturaProcessingService()

@router.post("/upload-pdf")
async def upload_factura_pdf(
    file: UploadFile = File(...),
    proveedor_id: int = Form(...),
    tipo_operacion_id: int = Form(...),
    auto_extract: bool = Form(default=False)
):
    """
    Endpoint para subir un PDF de factura y opcionalmente extraer datos
    
    Args:
        file: Archivo PDF de la factura
        proveedor_id: ID del proveedor
        tipo_operacion_id: ID del tipo de operación
        auto_extract: Si debe intentar extraer datos automáticamente
    
    Returns:
        JSON con datos extraídos o template para completar
    """
    
    # Validar tipo de archivo
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400, 
            detail="Solo se permiten archivos PDF"
        )
    
    # Validar tamaño (máximo 10MB)
    if file.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="El archivo es demasiado grande (máximo 10MB)"
        )
    
    try:
        # Crear directorio de destino
        upload_dir = Path("uploads/facturas")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generar nombre único para el archivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{file.filename}"
        file_path = upload_dir / safe_filename
        
        # Guardar archivo
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Procesar archivo
        if auto_extract:
            # En el futuro aquí se llamará al PDFExtractionService
            result_data = await factura_service.process_uploaded_pdf(
                str(file_path),
                file.filename,
                proveedor_id,
                tipo_operacion_id
            )
            
            return JSONResponse({
                "success": True,
                "message": "Archivo procesado exitosamente",
                "file_path": str(file_path),
                "auto_extracted": auto_extract,
                "data": result_data
            })
        else:
            # Solo subir archivo, sin extracción
            file_info = await factura_service.extract_basic_info(str(file_path))
            
            return JSONResponse({
                "success": True,
                "message": "Archivo subido exitosamente",
                "file_path": str(file_path),
                "auto_extracted": False,
                "file_info": file_info,
                "template_data": {
                    "proveedor_id": proveedor_id,
                    "tipo_operacion_id": tipo_operacion_id,
                    "nombre_archivo_pdf": file.filename,
                    "ruta_archivo_pdf": str(file_path)
                }
            })
            
    except Exception as e:
        # Limpiar archivo si algo sale mal
        if 'file_path' in locals() and Path(file_path).exists():
            os.remove(file_path)
        
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando archivo: {str(e)}"
        )

@router.post("/extract-from-file")
async def extract_data_from_existing_file(
    file_path: str = Form(...),
    proveedor_id: int = Form(...),
    tipo_operacion_id: int = Form(...)
):
    """
    Extrae datos de un archivo PDF ya subido
    
    Args:
        file_path: Ruta al archivo PDF existente
        proveedor_id: ID del proveedor
        tipo_operacion_id: ID del tipo de operación
    
    Returns:
        JSON con datos extraídos
    """
    
    # Verificar que el archivo existe
    if not Path(file_path).exists():
        raise HTTPException(
            status_code=404,
            detail="Archivo no encontrado"
        )
    
    # Validar que es un PDF
    if not factura_service.validate_file(file_path):
        raise HTTPException(
            status_code=400,
            detail="El archivo no es un PDF válido"
        )
    
    try:
        # Procesar con extracción
        result_data = await factura_service.process_uploaded_pdf(
            file_path,
            Path(file_path).name,
            proveedor_id,
            tipo_operacion_id
        )
        
        return JSONResponse({
            "success": True,
            "message": "Datos extraídos exitosamente",
            "file_path": file_path,
            "data": result_data
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error extrayendo datos: {str(e)}"
        )

@router.get("/files/")
async def list_factura_files():
    """
    Lista todos los archivos PDF de facturas guardados
    """
    try:
        facturas_dir = Path("uploads/facturas")
        if not facturas_dir.exists():
            return JSONResponse({
                "success": True,
                "files": [],
                "message": "Directorio de facturas no existe"
            })
        
        files = []
        for file_path in facturas_dir.glob("*.pdf"):
            file_stats = file_path.stat()
            files.append({
                "filename": file_path.name,
                "size": file_stats.st_size,
                "created": datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                "modified": datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
                "url": f"/uploads/facturas/{file_path.name}"
            })
        
        # Ordenar por fecha de creación (más recientes primero)
        files.sort(key=lambda x: x["created"], reverse=True)
        
        return JSONResponse({
            "success": True,
            "files": files,
            "total": len(files)
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listando archivos: {str(e)}"
        )

@router.get("/supported-types")
async def get_supported_file_types():
    """Retorna los tipos de archivo soportados"""
    return {
        "supported_types": factura_service.get_supported_file_types(),
        "max_size_mb": 10
    }

@router.delete("/file/{file_id}")
async def delete_uploaded_file(file_id: str):
    """
    Elimina un archivo subido
    
    Args:
        file_id: ID o ruta del archivo a eliminar
    """
    try:
        # Por seguridad, solo permitir eliminar archivos de la carpeta uploads
        file_path = Path("uploads/facturas") / file_id
        
        if not file_path.exists():
            raise HTTPException(
                status_code=404,
                detail="Archivo no encontrado"
            )
        
        # Verificar que está dentro del directorio permitido
        if not str(file_path.resolve()).startswith(str(Path("uploads/facturas").resolve())):
            raise HTTPException(
                status_code=400,
                detail="Ruta de archivo no válida"
            )
        
        os.remove(file_path)
        
        return JSONResponse({
            "success": True,
            "message": "Archivo eliminado exitosamente"
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error eliminando archivo: {str(e)}"
        )

@router.post("/test-pdf/")
async def test_pdf_endpoint():
    """
    Endpoint de prueba para verificar que las dependencias funcionan
    """
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info("Iniciando test de dependencias...")
        
        # Test 1: Importar PDFExtractionService
        logger.info("Test 1: Importando PDFExtractionService...")
        from app.services.pdf_extraction_service import PDFExtractionService
        logger.info("✓ PDFExtractionService importado correctamente")
        
        # Test 2: Inicializar servicio
        logger.info("Test 2: Inicializando servicio...")
        service = PDFExtractionService()
        logger.info("✓ Servicio inicializado correctamente")
        
        # Test 3: Verificar OpenAI
        import os
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            logger.info(f"✓ OpenAI API Key configurada: {'*' * (len(api_key) - 10)}{api_key[-10:]}")
        else:
            logger.info("⚠ OpenAI API Key no configurada")
        
        return JSONResponse({
            "success": True,
            "message": "Todas las dependencias funcionan correctamente",
            "openai_configured": bool(api_key)
        })
        
    except Exception as e:
        logger.error(f"Error en test: {str(e)}")
        logger.error(f"Tipo de error: {type(e).__name__}")
        return JSONResponse({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }, status_code=500)

@router.post("/parse-pdf/")
async def parse_document_endpoint(
    file: UploadFile = File(...),
    proveedor_id: Optional[int] = Form(None),
    tipo_operacion_id: Optional[int] = Form(None),
    extraction_method: str = Form(default="auto"),
    session: Session = Depends(get_session)
):
    """
    Procesa una factura desde PDF o imagen y extrae datos estructurados
    
    Tipos de archivo soportados:
    - PDFs: .pdf
    - Imágenes: .jpg, .jpeg, .png, .gif, .webp, .bmp, .tiff
    
    Args:
        file: Archivo PDF o imagen de la factura
        proveedor_id: ID del proveedor (opcional)
        tipo_operacion_id: ID del tipo de operación (opcional)
        extraction_method: Método de extracción ("auto", "text", "vision", "rules")
    
    Returns:
        JSON con datos extraídos de la factura
    """
    
    # Detectar tipo de archivo por extensión y content-type
    file_extension = Path(file.filename).suffix.lower()
    
    # Tipos soportados
    pdf_extensions = {'.pdf'}
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'}
    
    is_pdf = file_extension in pdf_extensions or 'pdf' in (file.content_type or '').lower()
    is_image = file_extension in image_extensions or 'image' in (file.content_type or '').lower()
    
    if not (is_pdf or is_image):
        raise HTTPException(
            status_code=400, 
            detail=f"Tipo de archivo no soportado: {file_extension}. "
                   f"Soportados: PDF ({', '.join(pdf_extensions)}) o "
                   f"Imágenes ({', '.join(image_extensions)})"
        )
    
    # Validar tamaño (máximo 10MB)
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="El archivo es demasiado grande (máximo 10MB)"
        )
    
    try:
        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Procesando archivo: {file.filename}")
        logger.info(f"Tamaño del archivo: {file.size if file.size else 'Unknown'}")
        logger.info(f"Tipo de contenido: {file.content_type}")
        logger.info(f"Método de extracción: {extraction_method}")
        logger.info(f"Tipo detectado: {'PDF' if is_pdf else 'Imagen'}")
        
        # Importar el servicio de extracción
        from app.services.pdf_extraction_service import PDFExtractionService
        
        # Crear directorios necesarios
        temp_dir = Path("uploads/temp")
        facturas_dir = Path("uploads/facturas")
        temp_dir.mkdir(parents=True, exist_ok=True)
        facturas_dir.mkdir(parents=True, exist_ok=True)
        
        # Generar nombres únicos
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = timestamp
        safe_filename = f"{unique_id}_{file.filename}"
        
        # Archivo temporal para procesamiento
        temp_file_path = temp_dir / f"temp_{safe_filename}"
        # Archivo permanente para almacenamiento
        permanent_file_path = facturas_dir / safe_filename
        
        # Guardar archivo temporalmente para procesamiento
        with open(temp_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        logger.info(f"Archivo guardado temporalmente en: {temp_file_path}")
        
        # Inicializar servicio de extracción
        logger.info("Inicializando PDFExtractionService...")
        try:
            extraction_service = PDFExtractionService()
            logger.info("PDFExtractionService inicializado correctamente")
        except Exception as e:
            logger.error(f"Error inicializando PDFExtractionService: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error inicializando servicio: {str(e)}")
        
        # Extraer datos según el tipo de archivo
        logger.info(f"Iniciando extracción de datos con método: {extraction_method}")
        try:
            if is_pdf:
                logger.info("Procesando como PDF...")
                extracted_data = await extraction_service.extract_from_pdf(str(temp_file_path), extraction_method)
            else:  # is_image
                logger.info("Procesando como imagen...")
                extracted_data = await extraction_service.extract_from_image(str(temp_file_path), extraction_method)
            
            logger.info("Extracción completada exitosamente")
        except Exception as e:
            logger.error(f"Error en extracción: {str(e)}")
            logger.error(f"Tipo de error: {type(e).__name__}")
            raise HTTPException(status_code=500, detail=f"Error extrayendo datos: {str(e)}")
        
        # Si la extracción fue exitosa, guardar el archivo permanentemente
        import shutil
        shutil.copy2(temp_file_path, permanent_file_path)
        logger.info(f"Archivo guardado permanentemente en: {permanent_file_path}")
        
        # Limpiar archivo temporal
        try:
            os.remove(temp_file_path)
            logger.info("Archivo temporal eliminado")
        except:
            logger.warning("No se pudo eliminar el archivo temporal")
        
        # Convertir resultado a diccionario
        result = {
            "numero": extracted_data.numero,
            "punto_venta": extracted_data.punto_venta,
            "tipo_comprobante": extracted_data.tipo_comprobante,
            "fecha_emision": extracted_data.fecha_emision,
            "fecha_vencimiento": extracted_data.fecha_vencimiento,
            "proveedor_nombre": extracted_data.proveedor_nombre,
            "proveedor_cuit": extracted_data.proveedor_cuit,
            "proveedor_direccion": extracted_data.proveedor_direccion,
            "receptor_nombre": extracted_data.receptor_nombre,
            "receptor_cuit": extracted_data.receptor_cuit,
            "receptor_direccion": extracted_data.receptor_direccion,
            "subtotal": extracted_data.subtotal,
            "total_impuestos": extracted_data.total_impuestos,
            "total": extracted_data.total,
            "detalles": extracted_data.detalles,
            "impuestos": extracted_data.impuestos,
            "confianza_extraccion": extracted_data.confianza_extraccion,
            "metodo_extraccion": extracted_data.metodo_extraccion,
            "texto_extraido": extracted_data.texto_extraido,
            "archivo_subido": safe_filename
        }
        
        # Persistir histórico de extracción (no bloquear si falla)
        try:
            import json as _json
            history = FacturaExtraccion(
                factura_id=None,
                archivo_nombre=file.filename,
                archivo_guardado=safe_filename,
                archivo_ruta=str(permanent_file_path),
                file_type=("pdf" if is_pdf else "image"),
                metodo_extraccion=extraction_method,
                extractor_version=getattr(extraction_service, "version", None),
                estado="exitoso",
                proveedor_id=proveedor_id,
                tipo_operacion_id=tipo_operacion_id,
                is_pdf=is_pdf,
                payload_json=_json.dumps(result, ensure_ascii=False),
            )
            session.add(history)
            session.commit()
        except Exception as _e:
            try:
                import logging as _logging
                _logging.getLogger(__name__).warning(f"No se pudo registrar histórico de extracción: {_e}")
            except Exception:
                pass

        return JSONResponse({
            "success": True,
            "message": f"{'PDF' if is_pdf else 'Imagen'} procesado exitosamente",
            "data": result,
            "filename": file.filename,
            "file_url": f"/uploads/facturas/{safe_filename}",
            "file_path": str(permanent_file_path),
            "file_type": "pdf" if is_pdf else "image"
        })
        
    except Exception as e:
        # Limpiar archivo temporal en caso de error
        try:
            if 'temp_file_path' in locals() and temp_file_path.exists():
                os.remove(temp_file_path)
        except:
            pass
            
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando PDF: {str(e)}"
        )
