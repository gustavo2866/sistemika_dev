#!/usr/bin/env python3
"""
Script para analizar el contenido de un PDF específico
"""

import sys
import os
from pathlib import Path

# Agregar el directorio actual al path
sys.path.append('.')

try:
    import fitz  # PyMuPDF
    import pdfplumber
    import json
    from app.services.pdf_extraction_service import PDFExtractionService
    print("✅ Todas las dependencias importadas correctamente")
except ImportError as e:
    print(f"❌ Error importando dependencias: {e}")
    sys.exit(1)

def analyze_pdf(pdf_path):
    """Analizar un PDF específico paso a paso"""
    
    if not os.path.exists(pdf_path):
        print(f"❌ Archivo no encontrado: {pdf_path}")
        return
    
    print(f"📄 Analizando: {pdf_path}\n")
    
    # 1. Extraer texto con PyMuPDF
    print("=== MÉTODO 1: PyMuPDF ===")
    try:
        doc = fitz.open(pdf_path)
        page = doc[0]
        text_fitz = page.get_text()
        print(f"Texto extraído ({len(text_fitz)} caracteres):")
        print(text_fitz[:500])
        print("\n" + "="*50 + "\n")
        doc.close()
    except Exception as e:
        print(f"Error con PyMuPDF: {e}")
        text_fitz = ""
    
    # 2. Extraer texto con pdfplumber
    print("=== MÉTODO 2: pdfplumber ===")
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[0]
            text_plumber = page.extract_text()
            print(f"Texto extraído ({len(text_plumber) if text_plumber else 0} caracteres):")
            print(text_plumber[:500] if text_plumber else "No se extrajo texto")
            print("\n" + "="*50 + "\n")
    except Exception as e:
        print(f"Error con pdfplumber: {e}")
        text_plumber = ""
    
    # 3. Usar el servicio completo
    print("=== MÉTODO 3: Servicio Completo ===")
    try:
        import asyncio
        
        async def test_service():
            service = PDFExtractionService()
            result = await service.extract_from_pdf(pdf_path)
            print("Resultado del servicio:")
            print(json.dumps({
                "numero": result.numero,
                "proveedor_nombre": result.proveedor_nombre,
                "proveedor_cuit": result.proveedor_cuit,
                "total": result.total,
                "metodo_extraccion": result.metodo_extraccion,
                "confianza_extraccion": result.confianza_extraccion
            }, indent=2))
        
        asyncio.run(test_service())
        
    except Exception as e:
        print(f"Error con el servicio: {e}")
    
    # 4. Análisis manual de patrones
    print("\n=== ANÁLISIS DE PATRONES ===")
    text_to_analyze = text_plumber or text_fitz
    
    if text_to_analyze:
        import re
        
        # Buscar número de factura
        numero_patterns = [
            r'N[°º]\s*(\d+)',
            r'FACTURA\s*N[°º]?\s*(\d+)',
            r'Número:\s*(\d+)',
            r'(\d{8,})',  # Números largos
        ]
        
        print("🔍 Búsqueda de número de factura:")
        for pattern in numero_patterns:
            matches = re.findall(pattern, text_to_analyze, re.IGNORECASE)
            if matches:
                print(f"  Patrón '{pattern}': {matches}")
        
        # Buscar nombres de proveedor
        print("\n🔍 Búsqueda de datos de proveedor:")
        lines = text_to_analyze.split('\n')[:10]  # Primeras 10 líneas
        for i, line in enumerate(lines):
            if line.strip():
                print(f"  Línea {i+1}: {line.strip()}")
    
    else:
        print("❌ No se pudo extraer texto para análisis")

if __name__ == "__main__":
    pdf_file = "uploads/facturas/20250913_093336_20222387753_011_00002_00000553.pdf"
    analyze_pdf(pdf_file)
