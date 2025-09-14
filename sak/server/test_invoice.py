#!/usr/bin/env python3
"""
Script para probar la extracción de datos del PDF específico
"""
import asyncio
import sys
import os
from pathlib import Path

# Añadir el directorio app al path
current_dir = Path(__file__).parent
app_dir = current_dir / "app"
sys.path.insert(0, str(app_dir))

from app.services.pdf_extraction_service import PDFExtractionService

async def test_invoice_extraction():
    """Prueba la extracción con el PDF específico"""
    
    # Configurar el servicio
    service = PDFExtractionService()
    
    # Archivo específico mencionado (buscar el más reciente)
    facturas_dir = os.path.join("uploads", "facturas")
    pdf_files = [f for f in os.listdir(facturas_dir) if f.endswith('20222387753_011_00002_00000553.pdf')]
    
    if not pdf_files:
        print("❌ Error: No se encontró el archivo del PDF mencionado")
        return
    
    # Usar el archivo más reciente
    pdf_file = sorted(pdf_files)[-1]
    pdf_path = os.path.join(facturas_dir, pdf_file)
    
    print(f"Probando extracción de: {pdf_file}")
    print(f"Ruta completa: {pdf_path}")
    
    # Verificar si el archivo existe
    if not os.path.exists(pdf_path):
        print(f"❌ Error: El archivo {pdf_path} no existe")
        print("Archivos disponibles en uploads/facturas/:")
        facturas_dir = os.path.join("uploads", "facturas")
        if os.path.exists(facturas_dir):
            for file in os.listdir(facturas_dir):
                if file.endswith('.pdf'):
                    print(f"  - {file}")
        else:
            print("  (El directorio uploads/facturas no existe)")
        return
    
    try:
        # Extraer datos
        print("\n🔍 Iniciando extracción...")
        result = await service.extract_from_pdf(pdf_path)
        
        print("\n✅ Extracción completada!")
        print("=" * 50)
        print(f"Método: {result.metodo_extraccion}")
        print(f"Confianza: {result.confianza_extraccion}")
        print(f"Número: {result.numero}")
        print(f"Proveedor: {result.proveedor_nombre}")
        print(f"CUIT: {result.proveedor_cuit}")
        print(f"Fecha: {result.fecha_emision}")
        print(f"Total: ${result.total}")
        print(f"Tipo: {result.tipo_comprobante}")
        print(f"Detalles: {len(result.detalles)} items")
        
        if result.detalles:
            print("\nDetalle de items:")
            for i, detalle in enumerate(result.detalles[:3], 1):  # Mostrar solo los primeros 3
                print(f"  {i}. {detalle}")
            if len(result.detalles) > 3:
                print(f"  ... y {len(result.detalles) - 3} más")
        
    except Exception as e:
        print(f"❌ Error durante la extracción: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_invoice_extraction())
