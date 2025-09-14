#!/usr/bin/env python3
"""
Test directo de extracción mejorada
"""
import asyncio
import sys
import os
from pathlib import Path

# Añadir el directorio app al path
current_dir = Path(__file__).parent
app_dir = current_dir / "app"
sys.path.insert(0, str(app_dir))

async def test_extraction():
    try:
        from app.services.pdf_extraction_service import PDFExtractionService
        
        service = PDFExtractionService()
        
        # Buscar el PDF
        facturas_dir = "uploads/facturas"
        pdf_files = [f for f in os.listdir(facturas_dir) if f.endswith('20222387753_011_00002_00000553.pdf')]
        
        if pdf_files:
            pdf_file = sorted(pdf_files)[-1]
            pdf_path = os.path.join(facturas_dir, pdf_file)
            
            print(f"Probando: {pdf_file}")
            print("=" * 50)
            
            result = await service.extract_from_pdf(pdf_path)
            
            print(f"Método: {result.metodo_extraccion}")
            print(f"Confianza: {result.confianza_extraccion}")
            print(f"Número: {result.numero}")
            print(f"Proveedor: {result.proveedor_nombre}")
            print(f"CUIT: {result.proveedor_cuit}")
            print(f"Fecha: {result.fecha_emision}")
            print(f"Total: ${result.total}")
            print(f"Tipo: {result.tipo_comprobante}")
            
            if result.detalles:
                print(f"Detalles: {len(result.detalles)} items")
                for detalle in result.detalles[:2]:
                    print(f"  - {detalle}")
        else:
            print("No se encontró el PDF")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_extraction())
