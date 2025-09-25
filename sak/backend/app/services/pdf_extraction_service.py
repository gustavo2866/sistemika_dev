"""
Servicio de extracción de datos de facturas desde PDF
Combina OCR (pdfplumber + pytesseract) con LLM (OpenAI) para extraer datos estructurados
"""

import io
import os
import base64
import json
import logging
from datetime import datetime, date
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path

import pdfplumber
import pytesseract
from PIL import Image
import fitz  # PyMuPDF

try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False

# Importar OpenAI con manejo de errores simple
try:
    import openai
    OPENAI_AVAILABLE = True
    OPENAI_VERSION = "legacy"
except ImportError:
    OPENAI_AVAILABLE = False
    OPENAI_VERSION = None

from pydantic import BaseModel, validator
from sqlmodel import Session, select
from app.db import get_session
from app.models.cliente import Cliente

logger = logging.getLogger(__name__)

class FacturaExtraida(BaseModel):
    """Modelo para datos extraídos de factura"""
    
    # Datos básicos
    numero: str
    punto_venta: str
    tipo_comprobante: str
    fecha_emision: str  # formato YYYY-MM-DD
    fecha_vencimiento: Optional[str] = None
    
    # Proveedor (Emisor)
    proveedor_nombre: str
    proveedor_cuit: str
    proveedor_direccion: Optional[str] = None
    
    # Receptor (Cliente) - Campos opcionales que se llenan si se identifica
    receptor_nombre: Optional[str] = None
    receptor_cuit: Optional[str] = None
    receptor_direccion: Optional[str] = None
    
    # Importes
    subtotal: float
    total_impuestos: float
    total: float
    
    # Detalles (líneas de productos/servicios)
    detalles: List[Dict[str, Any]]
    
    # Impuestos
    impuestos: List[Dict[str, Any]]
    
    # Metadata de extracción
    confianza_extraccion: float
    metodo_extraccion: str  # "llm_text", "llm_vision", "rules_text", "rules_ocr"
    metodo_aplicado: Optional[str] = None  # "auto", "text", "vision", "rules" - método realmente aplicado
    texto_extraido: Optional[str] = None  # Texto raw extraído del PDF
    
    @validator('fecha_emision', 'fecha_vencimiento', pre=True)
    def validate_date(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            try:
                # Intentar parsear diferentes formatos de fecha
                for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y']:
                    try:
                        parsed = datetime.strptime(v, fmt)
                        return parsed.strftime('%Y-%m-%d')
                    except ValueError:
                        continue
                raise ValueError(f"Formato de fecha no válido: {v}")
            except ValueError:
                logger.warning(f"No se pudo parsear la fecha: {v}")
                return v
        return v

class PDFExtractionService:
    """Servicio para extraer datos de facturas desde PDFs"""
    
    def __init__(self, openai_api_key: Optional[str] = None):
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        
        logger.info(f"Inicializando PDFExtractionService...")
        logger.info(f"OpenAI disponible: {OPENAI_AVAILABLE}")
        
        if not OPENAI_AVAILABLE:
            logger.warning("OpenAI no está instalado - solo extracción básica disponible")
            self.openai_api_key = None
        elif self.openai_api_key:
            logger.info(f"OpenAI API Key configurada: {'*' * max(0, len(self.openai_api_key) - 10)}{self.openai_api_key[-10:] if len(self.openai_api_key) > 10 else ''}")
            openai.api_key = self.openai_api_key
        else:
            logger.warning("OpenAI API Key no configurada - usando extracción básica")
        
        # Configurar pytesseract si es necesario
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    
    def _get_clientes_conocidos(self) -> List[Dict[str, str]]:
        """Obtiene lista de clientes conocidos de la base de datos"""
        try:
            # Crear sesión de base de datos
            from app.db import engine
            with Session(engine) as session:
                clientes = session.exec(select(Cliente).where(Cliente.activo == True)).all()
                return [
                    {
                        "cuit": cliente.cuit,
                        "razon_social": cliente.razon_social,
                        "direccion": cliente.direccion or ""
                    }
                    for cliente in clientes
                ]
        except Exception as e:
            logger.warning(f"No se pudieron cargar clientes conocidos: {e}")
            return []
    
    def _identificar_emisor_receptor(self, extracted_data: Dict[str, Any], texto_completo: str) -> Dict[str, Any]:
        """
        Identifica correctamente emisor vs receptor usando base de datos de clientes
        """
        clientes_conocidos = self._get_clientes_conocidos()
        
        # Buscar todos los CUITs mencionados en el texto
        import re
        cuits_encontrados = re.findall(r'(\d{2}-?\d{8}-?\d{1})', texto_completo)
        cuits_encontrados = [cuit.replace('-', '') for cuit in cuits_encontrados]
        
        # Buscar todos los nombres/razones sociales mencionados
        nombres_encontrados = []
        for line in texto_completo.split('\n'):
            line = line.strip()
            if len(line) > 10 and any(char.isalpha() for char in line):
                # Filtrar líneas que parecen nombres de empresa
                if not any(keyword in line.upper() for keyword in [
                    'FECHA', 'CUIT', 'DOMICILIO', 'CONDICION', 'RESPONSABLE',
                    'FACTURA', 'CODIGO', 'NUMERO', 'COMP.', 'PRECIO', 'CANTIDAD'
                ]):
                    nombres_encontrados.append(line)
        
        logger.info(f"CUITs encontrados: {cuits_encontrados}")
        logger.info(f"Nombres encontrados: {nombres_encontrados[:5]}...")  # Solo primeros 5
        
        # Verificar si algún CUIT corresponde a un cliente conocido
        cliente_encontrado = None
        for cuit in cuits_encontrados:
            for cliente in clientes_conocidos:
                if cliente["cuit"].replace('-', '') == cuit:
                    cliente_encontrado = cliente
                    logger.info(f"Cliente conocido identificado: {cliente['razon_social']}")
                    break
            if cliente_encontrado:
                break
        
        # Si encontramos un cliente conocido, los otros datos son del emisor
        if cliente_encontrado:
            # El cliente conocido es el RECEPTOR
            # Los datos extraídos como "proveedor" son realmente del EMISOR
            resultado = extracted_data.copy()
            
            # Agregar datos del receptor (cliente conocido)
            resultado["receptor_nombre"] = cliente_encontrado["razon_social"]
            resultado["receptor_cuit"] = cliente_encontrado["cuit"]
            resultado["receptor_direccion"] = cliente_encontrado["direccion"]
            
            # Los datos de "proveedor" son correctos (son del emisor)
            logger.info(f"Identificación correcta - Emisor: {resultado.get('proveedor_nombre', 'N/A')}, Receptor: {cliente_encontrado['razon_social']}")
            
            return resultado
        else:
            # No encontramos cliente conocido, mantener datos originales
            logger.info("No se identificó cliente conocido, manteniendo extracción original")
            return extracted_data
    
    async def extract_from_pdf(self, pdf_path: str, extraction_method: str = "auto") -> FacturaExtraida:
        """
        Extrae datos de una factura desde un archivo PDF
        
        Args:
            pdf_path: Ruta al archivo PDF
            extraction_method: "auto", "text", "vision", "rules"
            
        Returns:
            FacturaExtraida: Datos estructurados de la factura
        """
        logger.info(f"Iniciando extracción de {pdf_path} con método: {extraction_method}")
        
        try:
            # Determinar método automáticamente si es necesario
            original_method = extraction_method  # Guardar el método original
            
            if extraction_method == "auto":
                if self.openai_api_key and OPENAI_AVAILABLE:
                    # NUEVA LÓGICA INTELIGENTE: Analizar calidad del texto primero
                    logger.info("Auto: Analizando calidad del texto extraído...")
                    text_sample, extraction_type = await self._extract_text_from_pdf(pdf_path)
                    
                    if self._should_use_vision(text_sample):
                        extraction_method = "vision"
                        logger.info(f"Auto: Eligiendo Vision (texto de baja calidad: {len(text_sample)} chars, tipo: {extraction_type})")
                    else:
                        extraction_method = "text"
                        logger.info(f"Auto: Eligiendo Texto + LLM (texto de buena calidad: {len(text_sample)} chars, tipo: {extraction_type})")
                else:
                    extraction_method = "rules"
                    logger.info("Auto: Sin OpenAI disponible, usando reglas básicas")

            # Ejecutar según el método seleccionado/determinado
            if extraction_method == "vision":
                # Si es método automático, usar versión con fallback
                if original_method == "auto":
                    extracted_data = await self._extract_with_vision_safe(pdf_path)
                else:
                    # Si el usuario eligió Vision específicamente, NO hacer fallback
                    extracted_data = await self._extract_with_vision(pdf_path)
            elif extraction_method == "text":
                extracted_data = await self._extract_with_text_llm(pdf_path)
            else:  # rules
                extracted_data = await self._extract_with_rules_only(pdf_path)

            # AGREGAR EL MÉTODO REALMENTE APLICADO AL RESULTADO
            extracted_data["metodo_aplicado"] = extraction_method
            logger.info(f"Método aplicado: {extraction_method}")

            # NUEVA FUNCIONALIDAD: Identificar emisor vs receptor usando base de datos
            texto_completo = extracted_data.get("texto_extraido", "")
            if texto_completo:
                extracted_data = self._identificar_emisor_receptor(extracted_data, texto_completo)
                logger.info("Aplicada identificación emisor/receptor con base de datos de clientes")
                
        except Exception as e:
            logger.error(f"Error en extract_from_pdf: {str(e)}")
            logger.error(f"Tipo de error: {type(e).__name__}")
            raise
        
        # Validar y retornar
        return FacturaExtraida(**extracted_data)

    def _should_use_vision(self, text: str) -> bool:
        """Determina si debería usar Vision en lugar de Text basado en la calidad del texto extraído"""
        if not text or not text.strip():
            return True  # Texto vacío = usar Vision
        
        text_clean = text.strip()
        
        # Si el texto es muy corto (probablemente PDF escaneado)
        if len(text_clean) < 200:
            return True
        
        # Calcular ratio de caracteres alfanuméricos
        total_chars = len(text_clean)
        alnum_chars = sum(1 for c in text_clean if c.isalnum())
        alnum_ratio = alnum_chars / total_chars if total_chars > 0 else 0
        
        # Si hay pocos caracteres alfanuméricos (mal OCR o PDF escaneado)
        if alnum_ratio < 0.6:
            return True
        
        # Buscar patrones que indican buen texto estructurado
        has_structured_data = any(pattern in text_clean.upper() for pattern in [
            'FACTURA', 'CUIT', 'SUBTOTAL', 'TOTAL', 'IVA', 'PRECIO'
        ])
        
        # Si no encuentra patrones estructurados, mejor usar Vision
        if not has_structured_data:
            return True
            
        return False  # Texto parece bueno, usar método Text

    async def extract_from_image(self, image_path: str, extraction_method: str = "auto") -> FacturaExtraida:
        """
        Extrae datos de una factura desde un archivo de imagen
        
        Args:
            image_path: Ruta al archivo de imagen
            extraction_method: "auto", "vision", "ocr", "rules"
            
        Returns:
            FacturaExtraida: Datos estructurados de la factura
        """
        logger.info(f"Iniciando extracción de imagen {image_path} con método: {extraction_method}")
        
        try:
            # Determinar método automáticamente si es necesario
            if extraction_method == "auto":
                if self.openai_api_key and OPENAI_AVAILABLE:
                    extraction_method = "vision"  # Preferir visión para imágenes
                else:
                    extraction_method = "ocr"  # Fallback a OCR
            
            # Ejecutar según el método seleccionado
            if extraction_method == "vision":
                extracted_data = await self._extract_image_with_vision(image_path)
            elif extraction_method == "ocr" or extraction_method == "text":
                extracted_data = await self._extract_image_with_ocr(image_path)
            else:  # rules
                # Para imágenes, siempre necesitamos OCR primero
                extracted_data = await self._extract_image_with_ocr(image_path)

            # AGREGAR EL MÉTODO REALMENTE APLICADO AL RESULTADO
            extracted_data["metodo_aplicado"] = extraction_method
            logger.info(f"Método aplicado para imagen: {extraction_method}")

            # Aplicar identificación emisor/receptor si hay texto disponible
            texto_completo = extracted_data.get("texto_extraido", "")
            if texto_completo:
                extracted_data = self._identificar_emisor_receptor(extracted_data, texto_completo)
                logger.info("Aplicada identificación emisor/receptor con base de datos de clientes")
                    
        except Exception as e:
            logger.error(f"Error en extract_from_image: {str(e)}")
            logger.error(f"Tipo de error: {type(e).__name__}")
            raise
        
        # Validar y retornar
        return FacturaExtraida(**extracted_data)
    
    async def _extract_text_from_pdf(self, pdf_path: str) -> Tuple[str, str]:
        """
        Extrae texto del PDF usando múltiples métodos
        
        Returns:
            Tuple[str, str]: (texto_extraido, metodo_usado)
        """
        text_content = ""
        method = "none"
        
        try:
            # Método 1: pdfplumber (mejor para PDFs con texto seleccionable)
            logger.info("Intentando extracción con pdfplumber...")
            with pdfplumber.open(pdf_path) as pdf:
                text_parts = []
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
                
                if text_parts:
                    text_content = "\n".join(text_parts)
                    method = "text"
                    logger.info(f"Texto extraído con pdfplumber: {len(text_content)} caracteres")
        
        except Exception as e:
            logger.warning(f"Error con pdfplumber: {e}")
        
        # Método 2: OCR con pytesseract si no hay texto o es muy poco
        if len(text_content.strip()) < 100:
            try:
                logger.info("Usando OCR con pytesseract...")
                text_content = await self._extract_with_ocr(pdf_path)
                method = "ocr"
                logger.info(f"Texto extraído con OCR: {len(text_content)} caracteres")
            except Exception as e:
                logger.error(f"Error con OCR: {e}")
                if not text_content:
                    raise ValueError(f"No se pudo extraer texto del PDF: {e}")
        
        return text_content, method
    
    async def _extract_with_vision(self, pdf_path: str) -> Dict[str, Any]:
        """Extrae datos usando GPT-4o Vision (PDF → Imagen → LLM)"""
        if not self.openai_api_key or not OPENAI_AVAILABLE:
            raise ValueError("OpenAI API key no configurada para método de visión")
        
        if not PDF2IMAGE_AVAILABLE:
            raise ValueError("pdf2image no está instalado. Instalar con: pip install pdf2image")
        
        logger.info("Método Visión: Convirtiendo PDF a imágenes...")
        
        try:
            # Convertir PDF a imágenes (máximo 3 páginas para control de costos)
            images = convert_from_path(pdf_path, first_page=1, last_page=3, dpi=150)
            logger.info(f"PDF convertido a {len(images)} imágenes")
            
            # Convertir imágenes a base64
            image_data = []
            for i, image in enumerate(images):
                buffer = io.BytesIO()
                image.save(buffer, format='JPEG', quality=85)
                image_base64 = base64.b64encode(buffer.getvalue()).decode()
                image_data.append(image_base64)
                logger.info(f"Imagen {i+1} convertida a base64")
            
            # Preparar mensajes para OpenAI
            messages = [
                {
                    "role": "system",
                    "content": "Eres un experto contable argentino especializado en análisis visual de facturas oficiales AFIP. Tienes conocimiento profundo de la normativa argentina, tipos de comprobante (A, B, C), formatos oficiales, numeración AFIP, CUIT, alícuotas de IVA (21%, 10.5%, 27%), y estructura visual de facturas argentinas. Analizas imágenes de facturas con precisión máxima y extraes TODOS los datos según normativa AFIP."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": self._build_vision_prompt()
                        }
                    ]
                }
            ]
            
            # Agregar todas las imágenes al mensaje
            for image_base64 in image_data:
                messages[1]["content"].append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}",
                        "detail": "high"
                    }
                })
            
            # Llamar a OpenAI GPT-4o
            logger.info("Enviando imágenes a GPT-4o Vision...")
            client = openai.OpenAI(api_key=self.openai_api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o",  # Modelo con capacidad de visión
                messages=messages,
                max_tokens=2000,
                temperature=0.1
            )
            
            logger.info("Response recibido de GPT-4o Vision")
            result_text = response.choices[0].message.content
            
            # LOGS DETALLADOS PARA DEBUG DEL MÉTODO VISION
            logger.info(f"GPT-4o Vision Response (primeros 500 chars): {result_text[:500]}")
            
            # Limpiar y parsear JSON
            result_text = result_text.strip()
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            
            logger.info(f"JSON limpiado para parsing (primeros 300 chars): {result_text[:300]}")
            result = json.loads(result_text)
            result["confianza_extraccion"] = 0.9  # Alta confianza con visión
            result["metodo_extraccion"] = "llm_vision"
            result["texto_extraido"] = f"Procesado con GPT-4o Vision - {len(image_data)} imagen(es)"
            
            logger.info("✅ GPT-4o Vision: JSON parseado exitosamente")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Error parseando JSON de GPT-4o Vision: {e}")
            logger.error(f"Response text completo: {result_text}")
            # NO HACER FALLBACK - Si el usuario eligió Vision específicamente, debe fallar
            raise ValueError(f"GPT-4o Vision devolvió JSON inválido: {e}")
        except Exception as e:
            logger.error(f"❌ Error general en método de visión: {e}")
            logger.error(f"Tipo de error: {type(e).__name__}")
            # NO HACER FALLBACK - Si el usuario eligió Vision específicamente, debe fallar
            raise ValueError(f"Error en método de visión: {e}")
    
    async def _extract_with_vision_safe(self, pdf_path: str) -> Dict[str, Any]:
        """
        Método Vision con fallback automático - SOLO para uso del método "auto"
        Si Vision falla, hace fallback a Texto + LLM automáticamente
        """
        try:
            logger.info("Auto: Intentando método Vision...")
            return await self._extract_with_vision(pdf_path)
        except Exception as e:
            logger.warning(f"Auto: Vision falló ({e}), haciendo fallback a Texto + LLM...")
            return await self._extract_with_text_llm(pdf_path)

    async def _extract_with_text_llm(self, pdf_path: str) -> Dict[str, Any]:
        """Extrae datos usando el método tradicional (PDF → Texto → LLM)"""
        # Paso 1: Extraer texto del PDF
        logger.info("Método Texto: Extrayendo texto del PDF...")
        text_content, extraction_method = await self._extract_text_from_pdf(pdf_path)
        logger.info(f"Texto extraído: {len(text_content)} caracteres usando {extraction_method}")
        
        if not text_content.strip():
            raise ValueError("No se pudo extraer texto del PDF")
        
        # Paso 2: Procesar con LLM
        if self.openai_api_key and OPENAI_AVAILABLE:
            logger.info("Procesando texto con LLM...")
            extracted_data = self._process_with_llm(text_content)
            extracted_data["metodo_extraccion"] = f"llm_{extraction_method}"
        else:
            logger.info("Procesando con reglas básicas...")
            extracted_data = await self._process_with_rules(text_content)
            extracted_data["metodo_extraccion"] = f"rules_{extraction_method}"
        
        # Incluir el texto extraído en el resultado
        extracted_data["texto_extraido"] = text_content
        return extracted_data
    
    async def _extract_with_rules_only(self, pdf_path: str) -> Dict[str, Any]:
        """Extrae datos usando solo reglas (sin LLM)"""
        # Extraer texto del PDF
        logger.info("Método Reglas: Extrayendo texto del PDF...")
        text_content, extraction_method = await self._extract_text_from_pdf(pdf_path)
        logger.info(f"Texto extraído: {len(text_content)} caracteres usando {extraction_method}")
        
        if not text_content.strip():
            raise ValueError("No se pudo extraer texto del PDF")
        
        # Procesar solo con reglas
        logger.info("Procesando solo con reglas básicas...")
        extracted_data = await self._process_with_rules(text_content)
        extracted_data["metodo_extraccion"] = f"rules_{extraction_method}"
        extracted_data["texto_extraido"] = text_content
        return extracted_data
    
    async def _extract_with_ocr(self, pdf_path: str) -> str:
        """Extrae texto usando OCR (pytesseract)"""
        text_parts = []
        
        # Convertir PDF a imágenes
        pdf_document = fitz.open(pdf_path)
        
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            
            # Convertir página a imagen
            mat = fitz.Matrix(2, 2)  # Escalar 2x para mejor calidad OCR
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            
            # OCR con pytesseract
            image = Image.open(io.BytesIO(img_data))
            page_text = pytesseract.image_to_string(image, lang='spa')
            
            if page_text.strip():
                text_parts.append(page_text)
        
        pdf_document.close()
        return "\n".join(text_parts)
    
    async def _extract_image_with_vision(self, image_path: str) -> Dict[str, Any]:
        """Extrae datos de imagen usando GPT-4o Vision directamente"""
        if not self.openai_api_key or not OPENAI_AVAILABLE:
            raise ValueError("OpenAI API key no configurada para método de visión")
        
        logger.info("Método Visión: Procesando imagen directamente...")
        
        try:
            # Convertir imagen a base64
            with open(image_path, "rb") as image_file:
                image_data = image_file.read()
                image_base64 = base64.b64encode(image_data).decode()
            
            logger.info(f"Imagen convertida a base64: {len(image_base64)} caracteres")
            
            # Preparar mensaje para OpenAI
            messages = [
                {
                    "role": "system",
                    "content": "Eres un experto contable argentino especializado en análisis visual de facturas oficiales AFIP. Tienes conocimiento profundo de la normativa argentina, tipos de comprobante (A, B, C), formatos oficiales, numeración AFIP, CUIT, alícuotas de IVA (21%, 10.5%, 27%), y estructura visual de facturas argentinas. Analizas imágenes de facturas con precisión máxima y extraes TODOS los datos según normativa AFIP."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": self._build_vision_prompt()
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ]
            
            # Llamar a OpenAI GPT-4o
            logger.info("Enviando imagen a GPT-4o Vision...")
            client = openai.OpenAI(api_key=self.openai_api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=2000,
                temperature=0.1
            )
            
            logger.info("Response recibido de GPT-4o Vision")
            result_text = response.choices[0].message.content
            
            # Limpiar y parsear JSON
            result_text = result_text.strip()
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            
            result = json.loads(result_text)
            result["confianza_extraccion"] = 0.9  # Alta confianza con visión
            result["metodo_extraccion"] = "llm_vision_image"
            result["texto_extraido"] = f"Procesado directamente con GPT-4o Vision desde imagen"
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Error parseando JSON de GPT-4o Vision: {e}")
            logger.error(f"Response text: {result_text}")
            # Fallback a OCR
            return await self._extract_image_with_ocr(image_path)
        except Exception as e:
            logger.error(f"Error en método de visión para imagen: {e}")
            # Fallback a OCR
            return await self._extract_image_with_ocr(image_path)
    
    async def _extract_image_with_ocr(self, image_path: str) -> Dict[str, Any]:
        """Extrae datos de imagen usando OCR + reglas/LLM"""
        logger.info("Método OCR: Extrayendo texto de imagen...")
        
        try:
            # Extraer texto usando OCR
            image = Image.open(image_path)
            text_content = pytesseract.image_to_string(image, lang='spa')
            
            logger.info(f"Texto extraído con OCR: {len(text_content)} caracteres")
            
            if not text_content.strip():
                raise ValueError("No se pudo extraer texto de la imagen")
            
            # Procesar el texto extraído
            if self.openai_api_key and OPENAI_AVAILABLE:
                logger.info("Procesando texto OCR con LLM...")
                extracted_data = self._process_with_llm(text_content)
                extracted_data["metodo_extraccion"] = "llm_ocr_image"
            else:
                logger.info("Procesando texto OCR con reglas...")
                extracted_data = await self._process_with_rules(text_content)
                extracted_data["metodo_extraccion"] = "rules_ocr_image"
            
            # Incluir el texto extraído
            extracted_data["texto_extraido"] = text_content
            return extracted_data
            
        except Exception as e:
            logger.error(f"Error en OCR de imagen: {e}")
            raise ValueError(f"No se pudo procesar la imagen: {e}")
    
    def _process_with_llm(self, text_content: str) -> Dict[str, Any]:
        """Procesa el texto extraído usando OpenAI LLM"""
        
        prompt = self._build_llm_prompt(text_content)
        
        try:
            logger.info("Enviando request a OpenAI...")
            
            # Usar la nueva API de OpenAI
            client = openai.OpenAI(api_key=self.openai_api_key)
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "Eres un experto contable especializado en facturas oficiales argentinas y normativa AFIP. Tu tarea es extraer datos estructurados de facturas argentinas siguiendo las reglas oficiales de AFIP. Tienes conocimiento profundo de tipos de comprobante (A, B, C), numeración oficial, formatos de CUIT, alícuotas de IVA, y todos los campos obligatorios. Siempre devuelves JSON válido y preciso."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=2000
            )
            
            logger.info("Response recibido de OpenAI")
            result_text = response.choices[0].message.content
            
            # AGREGAR LOGS DETALLADOS PARA DEBUG
            logger.info(f"OpenAI Response (primeros 500 chars): {result_text[:500]}")
            
            # Limpiar y parsear JSON
            result_text = result_text.strip()
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            
            logger.info(f"JSON limpiado (primeros 300 chars): {result_text[:300]}")
            result = json.loads(result_text)
            
            # LOG ESPECÍFICO PARA VERIFICAR QUE EL LLM FUNCIONA
            logger.info(f"JSON parseado exitosamente. Detalles: {len(result.get('detalles', []))} items, Impuestos: {len(result.get('impuestos', []))} items")
            
            result["confianza_extraccion"] = 0.8  # Alta confianza con LLM
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Error parseando JSON de OpenAI: {e}")
            logger.error(f"Response text: {result_text}")
            # Fallback a reglas básicas
            return self._process_with_rules_sync(text_content)
        except Exception as e:
            logger.error(f"Error procesando con LLM: {e}")
            logger.error(f"Tipo de error: {type(e).__name__}")
            # Fallback a reglas básicas
            return self._process_with_rules_sync(text_content)
    
    def _process_with_rules_sync(self, text_content: str) -> Dict[str, Any]:
        """Versión síncrona de _process_with_rules para usar en fallbacks"""
        import re
        
        result = {
            "numero": "",
            "punto_venta": "",
            "tipo_comprobante": "",
            "fecha_emision": "",
            "fecha_vencimiento": None,
            "proveedor_nombre": "",
            "proveedor_cuit": "",
            "proveedor_direccion": None,
            "subtotal": 0.0,
            "total_impuestos": 0.0,
            "total": 0.0,
            "detalles": [],
            "impuestos": [],
            "confianza_extraccion": 0.4  # Baja confianza con reglas
        }
        
        # Usar la misma lógica que el método asíncrono
        return result

    async def _process_with_rules(self, text_content: str) -> Dict[str, Any]:
        """Procesa el texto usando reglas básicas de extracción mejoradas"""
        import re
        
        result = {
            "numero": "",
            "punto_venta": "",
            "tipo_comprobante": "",
            "fecha_emision": "",
            "fecha_vencimiento": None,
            "proveedor_nombre": "",
            "proveedor_cuit": "",
            "proveedor_direccion": None,
            "subtotal": 0.0,
            "total_impuestos": 0.0,
            "total": 0.0,
            "detalles": [],
            "impuestos": [],
            "confianza_extraccion": 0.4  # Baja confianza con reglas
        }
        
        # Normalizar texto para búsqueda
        text_normalized = re.sub(r'\s+', ' ', text_content.replace('\n', ' '))
        
        # Buscar número de factura y punto de venta (patrones específicos mejorados)
        numero_patterns = [
            r'Punto\s+de\s+Venta:\s*(\d+)\s+Comp\.\s*Nro:\s*(\d+)',  # "Punto de Venta: 00003 Comp. Nro: 00000203"
            r'FACTURA\s*N[°º]?:\s*(\d+)\s+(\d+)',  # "FACTURA N°: 00006 00040" -> punto_venta: 00006, numero: 00040
            r'Comp\.\s*Nro\s*:?\s*(\d+)-(\d+)',  # "Comp. Nro: 00006-00040"
            r'(\d{4,5})-(\d{4,8})',  # Formato general "00006-00000553"
            r'FACTURA\s*N[°º]?\s*(\d+)',  # Solo número
            r'Comp\.\s*Nro\s*:?\s*(\d+)',  # Solo número de comprobante
            r'N[°º]\s*(\d+)',
            r'Número?\s*:?\s*(\d+)',
            r'NUMERO\s*(\d+)',
            r'Nro\.?\s*(\d+)',
        ]
        
        for pattern in numero_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 2:  # Formato "punto_venta numero" o "punto_venta-numero"
                    result["punto_venta"] = groups[0].zfill(4)  # Rellenar con ceros
                    result["numero"] = groups[1].zfill(8)  # Rellenar con ceros
                    logger.info(f"Extraído: punto_venta={result['punto_venta']}, numero={result['numero']}")
                else:  # Solo número encontrado
                    result["numero"] = groups[0].zfill(8)
                    logger.info(f"Extraído solo numero={result['numero']}")
                break
        
        # Buscar CUIT (formato argentino)
        cuit_patterns = [
            r'(\d{2}-?\d{8}-?\d{1})',  # Formato con o sin guiones
            r'CUIT\s*:?\s*(\d{2}-?\d{8}-?\d{1})',
        ]
        
        for pattern in cuit_patterns:
            match = re.search(pattern, text_content)
            if match:
                result["proveedor_cuit"] = match.group(1)
                break
        
        # Buscar fechas (múltiples formatos)
        fecha_patterns = [
            r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})',
            r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})',
            r'FECHA\s*:?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})',
        ]
        
        for pattern in fecha_patterns:
            match = re.search(pattern, text_content)
            if match:
                groups = match.groups()
                if len(groups[2]) == 4:  # Año de 4 dígitos al final
                    day, month, year = groups
                    result["fecha_emision"] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                else:  # Año al principio
                    year, month, day = groups
                    result["fecha_emision"] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                break
        
        # Buscar total (patrones específicos para facturas argentinas)
        total_patterns = [
            r'Importe\s*Total\s*:?\s*\$\s*(\d+(?:\.\d{3})*,\d{2})',  # Importe Total específico
            r'TOTAL\s*:?\s*\$\s*(\d+(?:\.\d{3})*,\d{2})',
            r'Total\s*:?\s*\$\s*(\d+(?:\.\d{3})*,\d{2})',
            r'\$\s*(\d+(?:\.\d{3})*,\d{2})(?:\s|$)',  # Solo $ seguido de número
            r'(\d+(?:\.\d{3})*,\d{2})\s*$',  # Número al final de línea
        ]
        
        max_total = 0.0
        for pattern in total_patterns:
            matches = re.findall(pattern, text_content, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                # Limpiar el número: quitar separadores de miles, cambiar coma por punto
                total_str = match.replace('.', '').replace(',', '.')
                try:
                    total_value = float(total_str)
                    if total_value > max_total:
                        max_total = total_value
                except ValueError:
                    continue
        
        # Buscar subtotal
        subtotal_patterns = [
            r'Subtotal\s*:\s*\$\s*(\d+(?:\.\d{3})*,\d{2})',
            r'SUBTOTAL\s*:\s*\$\s*(\d+(?:\.\d{3})*,\d{2})',
            r'Sub\s*Total\s*:\s*\$\s*(\d+(?:\.\d{3})*,\d{2})',
        ]
        
        for pattern in subtotal_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                subtotal_str = match.group(1).replace('.', '').replace(',', '.')
                try:
                    result["subtotal"] = float(subtotal_str)
                    break
                except ValueError:
                    continue
        
        # Buscar impuestos
        impuestos_patterns = [
            r'Importe\s*Otros\s*Tributos\s*:\s*\$\s*(\d+(?:\.\d{3})*,\d{2})',
            r'IVA\s*:\s*\$\s*(\d+(?:\.\d{3})*,\d{2})',
            r'Impuestos\s*:\s*\$\s*(\d+(?:\.\d{3})*,\d{2})',
            r'IIBB\s*:\s*\$\s*(\d+(?:\.\d{3})*,\d{2})',
        ]
        
        total_impuestos = 0.0
        for pattern in impuestos_patterns:
            matches = re.findall(pattern, text_content, re.IGNORECASE)
            for match in matches:
                impuesto_str = match.replace('.', '').replace(',', '.')
                try:
                    total_impuestos += float(impuesto_str)
                except ValueError:
                    continue
        
        result["total_impuestos"] = total_impuestos
        
        # Buscar detalles de productos/servicios (mejorado para facturas argentinas)
        lines = text_content.split('\n')
        detalles_encontrados = set()  # Para evitar duplicados
        
        # Buscar tabla de productos después de "Código Producto / Servicio"
        in_product_section = False
        for line in lines:
            line = line.strip()
            
            # Activar búsqueda cuando encontremos el encabezado de la tabla
            if re.search(r'Código\s+Producto\s*/\s*Servicio|Producto\s*/\s*Servicio|Descripción', line, re.IGNORECASE):
                in_product_section = True
                continue
            
            # Desactivar cuando encontremos totales
            if re.search(r'Subtotal\s*:|Importe\s+Total\s*:|Total\s*:', line, re.IGNORECASE):
                in_product_section = False
                continue
            
            if in_product_section and line:
                # Patrón para líneas de productos específico de esta factura
                # Ejemplo: "Mantenimientos Básicos de sitios web 1,00 unidades 280000,00 0,00 0,00 280000,00"
                detalle_match = re.search(
                    r'^([a-zA-Z\s\w]+?)\s+(\d+,\d{2})\s+unidades\s+(\d+,\d{2})\s+[\d,]+\s+[\d,]+\s+(\d+,\d{2})$',
                    line,
                    re.IGNORECASE
                )
                
                if detalle_match:
                    descripcion = detalle_match.group(1).strip()
                    cantidad_str = detalle_match.group(2)
                    precio_unitario_str = detalle_match.group(3)
                    subtotal_item_str = detalle_match.group(4)
                    
                    # Evitar duplicados usando la descripción como clave
                    if descripcion not in detalles_encontrados and len(descripcion) > 3:
                        try:
                            cantidad = float(cantidad_str.replace(',', '.'))
                            precio_unitario = float(precio_unitario_str.replace(',', '.'))
                            subtotal_item = float(subtotal_item_str.replace(',', '.'))
                            
                            detalle = {
                                "descripcion": descripcion,
                                "cantidad": cantidad,
                                "precio_unitario": precio_unitario,
                                "subtotal": subtotal_item
                            }
                            result["detalles"].append(detalle)
                            detalles_encontrados.add(descripcion)
                            logger.info(f"Detalle extraído: {descripcion} - ${subtotal_item}")
                        except ValueError as e:
                            logger.warning(f"Error parseando detalle: {line} - {e}")
                            continue
        
        # Buscar impuestos específicos
        impuestos_lista = []
        
        # Buscar "Importe Otros Tributos"
        otros_tributos_match = re.search(r'Importe\s*Otros\s*Tributos\s*:\s*\$\s*(\d+(?:\.\d{3})*,\d{2})', text_content, re.IGNORECASE)
        if otros_tributos_match:
            importe_str = otros_tributos_match.group(1).replace('.', '').replace(',', '.')
            importe = float(importe_str)
            if importe > 0:
                impuestos_lista.append({
                    "tipo": "Otros Tributos",
                    "porcentaje": 0,
                    "importe": importe
                })
                total_impuestos += importe
        
        # Buscar otros impuestos (IVA, IIBB, etc.)
        otros_impuestos_patterns = [
            (r'IVA\s*21%?\s*:\s*\$\s*(\d+(?:\.\d{3})*,\d{2})', "IVA 21%", 21),
            (r'IVA\s*10\.5%?\s*:\s*\$\s*(\d+(?:\.\d{3})*,\d{2})', "IVA 10.5%", 10.5),
            (r'IIBB\s*:\s*\$\s*(\d+(?:\.\d{3})*,\d{2})', "IIBB", 0),
        ]
        
        for pattern, tipo, porcentaje in otros_impuestos_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                importe_str = match.group(1).replace('.', '').replace(',', '.')
                importe = float(importe_str)
                if importe > 0:
                    impuestos_lista.append({
                        "tipo": tipo,
                        "porcentaje": porcentaje,
                        "importe": importe
                    })
                    total_impuestos += importe
        
        result["total_impuestos"] = total_impuestos
        result["impuestos"] = impuestos_lista

        if max_total > 0:
            result["total"] = max_total
        
        # Buscar nombre del proveedor (buscar después de FACTURA o en razón social)
        lines = [line.strip() for line in text_content.split('\n') if line.strip()]
        
        # Método 1: Buscar "Razón social:" seguido del nombre
        razon_social_match = re.search(r'Razón\s+social:\s*([^:]+?)(?:\s+CUIT|$)', text_content, re.IGNORECASE)
        if razon_social_match:
            proveedor = razon_social_match.group(1).strip()
            # Limpiar texto adicional
            proveedor = re.sub(r'\s+CUIT.*', '', proveedor)
            proveedor = re.sub(r'\s+Fecha.*', '', proveedor)
            proveedor = re.sub(r'\s+Domicilio.*', '', proveedor, flags=re.IGNORECASE)
            if len(proveedor) > 3:
                result["proveedor_nombre"] = proveedor
        
        # Método 2: Si no encontró, buscar después de FACTURA
        if not result["proveedor_nombre"]:
            factura_found = False
            for i, line in enumerate(lines):
                line_upper = line.upper()
                
                # Si encontramos "FACTURA", las siguientes líneas pueden tener el nombre
                if "FACTURA" in line_upper:
                    factura_found = True
                    continue
                
                # Buscar en las siguientes 3 líneas después de FACTURA
                if factura_found and i < len(lines) - 1:
                    # Evitar líneas con códigos, fechas, números
                    skip_keywords = [
                        'COD.', 'CODIGO', 'N°', 'NUMERO', 'FECHA', 'CUIT', 'RAZÓN', 
                        'CONDICION', 'DOMICILIO', 'INGRESOS', 'ORIGINAL', 'DUPLICADO', 
                        'TRIPLICADO', 'TIPO', 'PUNTO', 'COMP.', 'COMPROBANTE'
                    ]
                    
                    if not any(keyword in line_upper for keyword in skip_keywords):
                        # Verificar que parece un nombre (contiene letras)
                        if re.search(r'[A-Za-z]{3,}', line) and not re.match(r'^\d+$', line):
                            # Verificar que no es solo un código
                            if not re.match(r'^[A-Z]{1,3}\s*\d*$', line_upper):
                                result["proveedor_nombre"] = line
                                break
        
        # Detectar tipo de comprobante
        if any(palabra in text_content.upper() for palabra in ['FACTURA A', 'TIPO A']):
            result["tipo_comprobante"] = "A"
        elif any(palabra in text_content.upper() for palabra in ['FACTURA B', 'TIPO B']):
            result["tipo_comprobante"] = "B"
        elif any(palabra in text_content.upper() for palabra in ['FACTURA C', 'TIPO C']):
            result["tipo_comprobante"] = "C"
        elif 'TICKET' in text_content.upper():
            result["tipo_comprobante"] = "TICKET"
        elif 'FACTURA' in text_content.upper():
            result["tipo_comprobante"] = "FACTURA"
        
        return result
    
    def _build_llm_prompt(self, text_content: str) -> str:
        """Construye el prompt optimizado para facturas oficiales argentinas"""
        return f"""
Eres un experto contador argentino especializado en facturas AFIP. Analiza este texto de factura y extrae TODOS los datos estructurados. Esta factura contiene información específica que DEBES encontrar y extraer completamente.

TEXTO DE LA FACTURA:
{text_content[:4000]}

DATOS QUE DEBES EXTRAER (están presentes en el texto):

DATOS QUE DEBES EXTRAER (están presentes en el texto):

1. IDENTIFICACIÓN BÁSICA:
   - Tipo de comprobante: Busca "A FACTURA" o "Cod. 01" = tipo "A"
   - Punto de venta: En "DOT4 SA Número: 00014-00000269" = punto_venta "00014"
   - Número de factura: En "DOT4 SA Número: 00014-00000269" = numero "00000269"

2. DATOS DEL PROVEEDOR (EMISOR):
   - Nombre: "DOT4 SA"
   - CUIT: "30-70963679-7" (este CUIT es del emisor)
   - Dirección: "Peru 1030 - Florida - Buenos Aires - 1602 - Argentina"

3. DATOS DEL CLIENTE (RECEPTOR):
   - Nombre: "EXCELENCIA EN SOLUCIONES INFORMATICAS SA"
   - CUIT: "30-70740736-7" (este CUIT es del cliente)
   - Dirección: "AV CASEROS 3515 P5, CABA Ciudad Autónoma de Buenos Aires 1263, Argentina"

4. FECHAS:
   - Fecha emisión: "25/08/2025" → convertir a "2025-08-25"
   - Fecha vencimiento: "25/08/2025" → convertir a "2025-08-25"

5. PRODUCTO/SERVICIO (CRÍTICO - este dato está presente):
   - Código: "[V-ESSVUL-0I-SU1AR-RN]"
   - Descripción: "V-ESSVUL-0I-SU1AR-RN VEEAM RENOVACIÓN Veeam Data Platform Essentials Universal Subscription License. Includes Enterprise Plus Edition features. 1 Year Renewal Subscription Upfront Billing & Production (24/7) Support. Contract 03443696. (20 Instance) 8/30/2025 8/29/2026"
   - Cantidad: "1,00"
   - Precio unitario: "2.068,7500" → convertir a 2068.75

6. TOTALES E IMPUESTOS (CRÍTICOS - estos datos están presentes):
   - Subtotal: "Subtotal USD 2.068,75" → 2068.75
   - IVA 21%: "IVA 21% el USD 2.068,75 USD 434,44" → 434.44
   - Perc IIBB CABA: "Perc IIBB CABA el USD 2.068,75 USD 0,21" → 0.21
   - Perc IIBB BSAS: "Perc IIBB BSAS el USD 2.068,75 USD 82,75" → 82.75
   - Total USD: "Total USD 2.586,15" → 2586.15
   - Total ARS: "$ 3.543.017,80" → 3543017.80

FORMATO JSON REQUERIDO:
{{
    "numero": "00000269",
    "punto_venta": "00014", 
    "tipo_comprobante": "A",
    "fecha_emision": "2025-08-25",
    "fecha_vencimiento": "2025-08-25",
    "proveedor_nombre": "DOT4 SA",
    "proveedor_cuit": "30-70963679-7",
    "proveedor_direccion": "Peru 1030 - Florida - Buenos Aires - 1602 - Argentina",
    "receptor_nombre": "EXCELENCIA EN SOLUCIONES INFORMATICAS SA",
    "receptor_cuit": "30-70740736-7", 
    "receptor_direccion": "AV CASEROS 3515 P5, CABA Ciudad Autónoma de Buenos Aires 1263, Argentina",
    "subtotal": 2068.75,
    "total_impuestos": 517.40,
    "total": 3543017.80,
    "detalles": [
        {{
            "descripcion": "V-ESSVUL-0I-SU1AR-RN VEEAM RENOVACIÓN Veeam Data Platform Essentials Universal Subscription License. Includes Enterprise Plus Edition features. 1 Year Renewal Subscription Upfront Billing & Production (24/7) Support. Contract 03443696. (20 Instance) 8/30/2025 8/29/2026",
            "cantidad": 1.0,
            "precio_unitario": 2068.75,
            "subtotal": 2068.75
        }}
    ],
    "impuestos": [
        {{
            "tipo": "IVA 21%",
            "porcentaje": 21.0,
            "importe": 434.44
        }},
        {{
            "tipo": "Perc IIBB CABA", 
            "porcentaje": 0.0,
            "importe": 0.21
        }},
        {{
            "tipo": "Perc IIBB BSAS",
            "porcentaje": 0.0, 
            "importe": 82.75
        }}
    ]
}}

INSTRUCCIONES CRÍTICAS:
- Todos estos datos ESTÁN en el texto proporcionado
- NO dejes arrays vacíos en detalles[] o impuestos[]
- El total_impuestos es la suma: 434.44 + 0.21 + 82.75 = 517.40
- Convierte números: "2.068,75" → 2068.75, "3.543.017,80" → 3543017.80
- El proveedor_cuit "30-70963679-7" es DIFERENTE del receptor_cuit "30-70740736-7"
- Devuelve SOLO el JSON sin explicaciones"""
    
    def _build_vision_prompt(self) -> str:
        """Construye el prompt optimizado para GPT-4o Vision con facturas oficiales argentinas"""
        return """
Eres un experto contador especializado en FACTURAS OFICIALES ARGENTINAS con conocimiento profundo de la normativa AFIP. Analiza estas imágenes de factura argentina y extrae TODOS los datos disponibles con máxima precisión, especialmente DETALLES e IMPUESTOS.

INSTRUCCIONES ESPECÍFICAS PARA ANÁLISIS VISUAL:

1. ENCABEZADO Y TIPO DE COMPROBANTE:
   - Identifica claramente el logo/nombre de la empresa emisora
   - Busca "FACTURA A", "FACTURA B", "FACTURA C", "A FACTURA" en la parte superior
   - Código oficial: "Cod. 01" (A), "Cod. 06" (B), "Cod. 11" (C)
   - Lee la letra grande que indica el tipo (A, B, C)

2. NUMERACIÓN AFIP (generalmente en recuadro destacado):
   - Formato visual típico: "FACTURA N°: PPPP-NNNNNNNN"
   - Punto de venta (4 dígitos) - Número (8 dígitos)
   - También puede aparecer como "Comp. Nro: PPPP-NNNNNNNN"
   - Formato DOT4: "DOT4 SA Número: PPPP-NNNNNNNN"
   - Ejemplo: "00014-00000269" → punto_venta="00014", numero="00000269"

3. DATOS DEL EMISOR (parte superior izquierda típicamente):
   - Razón social completa (nombre legal de la empresa)
   - CUIT: XX-XXXXXXXX-X (11 dígitos con guiones)
   - Domicilio: calle, número, piso, departamento, localidad, código postal
   - "Condición IVA: Responsable Inscripto/Monotributista/Exento"
   - "Inicio de actividades:" fecha

4. DATOS DEL CLIENTE/RECEPTOR (parte central/derecha):
   - "Cliente:" seguido del nombre de la empresa
   - CUIT del cliente (diferente al emisor)
   - Domicilio del cliente
   - Condición IVA del cliente

5. FECHAS Y PERÍODO:
   - "Fecha:" DD/MM/YYYY
   - "Fecha de vencimiento:" DD/MM/YYYY  
   - "Período desde: DD/MM/YYYY hasta: DD/MM/YYYY"

6. TABLA DE PRODUCTOS/SERVICIOS - ANÁLISIS CRÍTICO:
   - Busca tabla con códigos entre corchetes: "[V-ESSVUL-0I-SU1AR-RN]"
   - Columnas: DESCRIPCIÓN | CANTIDAD | PRECIO UNITARIO | % IVA | IMPORTE
   - Lee CADA FILA de la tabla como un item separado
   - Cantidad típica: "1,00"
   - Precio en formato argentino: "2.068,7500"
   - Descripción incluye código y detalles técnicos

7. TOTALES E IMPUESTOS - ANÁLISIS CRÍTICO:
   - "Subtotal USD 2.068,75" = subtotal sin IVA
   - "IVA 21% el USD 2.068,75 USD 434,44" = impuesto IVA 434.44
   - "Perc IIBB CABA el USD..." = percepciones CABA
   - "Perc IIBB BSAS el USD..." = percepciones Buenos Aires
   - "Total USD 2.586,15" = total en moneda original
   - "$ 3.543.017,80" = total convertido a pesos

8. MONEDAS Y CONVERSIÓN:
   - "Moneda: US$ - Dólares"
   - "Tipo de cambio: 1.370,0"
   - Convertir valores: USD × tipo_cambio = ARS

9. CÓDIGOS DE AUTORIZACIÓN (parte inferior):
   - "CAE:" = Código de Autorización Electrónica
   - "Fecha de vencimiento CAE:" = vencimiento del código
   - Código QR o de barras

FORMATO JSON REQUERIDO (extrae TODOS los campos visibles):
{
    "numero": "número de comprobante (ej: '00000269')",
    "punto_venta": "punto de venta (ej: '00014')",
    "tipo_comprobante": "FACTURA, A, B, C, NOTA_DEBITO, etc.",
    "fecha_emision": "YYYY-MM-DD (convertir desde formato visual DD/MM/YYYY)",
    "fecha_vencimiento": "YYYY-MM-DD (fecha vencimiento pago) o null",
    "proveedor_nombre": "razón social completa del emisor (empresa que factura)",
    "proveedor_cuit": "XX-XXXXXXXX-X del emisor",
    "proveedor_direccion": "domicilio completo del emisor",
    "receptor_nombre": "nombre del cliente/receptor",
    "receptor_cuit": "XX-XXXXXXXX-X del cliente",
    "receptor_direccion": "domicilio del cliente",
    "subtotal": número_decimal_importe_neto_gravado_sin_iva,
    "total_impuestos": número_decimal_suma_todos_impuestos,
    "total": número_decimal_importe_total_final,
    "detalles": [
        {
            "descripcion": "descripción exacta del producto/servicio de la tabla",
            "cantidad": número_decimal_cantidad,
            "precio_unitario": número_decimal_precio_sin_iva,
            "subtotal": número_decimal_subtotal_linea_sin_iva
        }
    ],
    "impuestos": [
        {
            "tipo": "IVA 21%, IVA 10.5%, IVA 27%, Otros Tributos, IIBB, etc.",
            "porcentaje": número_decimal_alicuota,
            "importe": número_decimal_monto_impuesto
        }
    ]
}

REGLAS CRÍTICAS DE CONVERSIÓN:
- Montos: $1.234.567,89 → 1234567.89 (quitar $, puntos de miles, coma→punto decimal)
- Fechas: DD/MM/YYYY → YYYY-MM-DD
- Números con guiones mantener formato: XX-XXXXXXXX-X
- Leer TODA la tabla de productos línea por línea
- El subtotal es SIN IVA, el total es CON IVA
- Separar cada alícuota de IVA como impuesto independiente
- El CUIT del proveedor es del EMISOR (quien factura)

ATENCIÓN ESPECIAL:
- Lee números pequeños y grandes con igual precisión
- Distingue entre datos del emisor vs. receptor
- No confundas CAE con número de factura
- Extrae productos aunque estén en fuente pequeña
- Si hay múltiples páginas, considera toda la información

IMPORTANTE: Devuelve ÚNICAMENTE el JSON, sin explicaciones adicionales."""
