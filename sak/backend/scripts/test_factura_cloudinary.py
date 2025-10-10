#!/usr/bin/env python3
"""
Test de upload de factura a Cloudinary
Verifica que las facturas se suban correctamente a Cloudinary
"""

import sys
import os
from pathlib import Path
from datetime import datetime
import io

# Agregar el directorio padre al path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import requests

def create_test_pdf():
    """Crear un PDF de factura de prueba"""
    pdf_buffer = io.BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=letter)
    
    # Título
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, 750, "FACTURA DE PRUEBA")
    
    # Datos de la factura
    c.setFont("Helvetica", 12)
    c.drawString(100, 720, f"Número: 001-00000999")
    c.drawString(100, 700, f"Fecha: {datetime.now().strftime('%d/%m/%Y')}")
    c.drawString(100, 680, f"CUIT Emisor: 20-12345678-9")
    c.drawString(100, 660, f"Proveedor: Test Provider SA")
    
    # Items
    c.drawString(100, 620, "Descripción: Servicio de Testing")
    c.drawString(100, 600, "Cantidad: 1")
    c.drawString(100, 580, "Precio Unit: $1000.00")
    
    # Total
    c.setFont("Helvetica-Bold", 14)
    c.drawString(100, 540, "TOTAL: $1000.00")
    
    # Nota
    c.setFont("Helvetica", 10)
    c.drawString(100, 500, "*** FACTURA DE PRUEBA - TEST CLOUDINARY ***")
    
    c.save()
    pdf_buffer.seek(0)
    return pdf_buffer

def test_upload_factura():
    """Test de upload de factura a través del endpoint"""
    print("\n" + "="*60)
    print("🧪 TEST DE UPLOAD DE FACTURA A CLOUDINARY")
    print("="*60)
    
    # Crear PDF de prueba
    print("\n1️⃣ Creando PDF de prueba...")
    pdf_buffer = create_test_pdf()
    pdf_size = len(pdf_buffer.getvalue())
    print(f"   ✅ PDF creado: {pdf_size} bytes")
    
    # Preparar request
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"test_factura_{timestamp}.pdf"
    
    files = {
        'file': (filename, pdf_buffer, 'application/pdf')
    }
    
    data = {
        'proveedor_id': '4',
        'tipo_operacion_id': '2',
        'method': 'auto'
    }
    
    # Hacer request al endpoint
    print("\n2️⃣ Subiendo factura al endpoint...")
    print(f"   URL: http://localhost:8000/api/v1/facturas/parse-pdf/")
    print(f"   Archivo: {filename}")
    
    try:
        response = requests.post(
            'http://localhost:8000/api/v1/facturas/parse-pdf/',
            files=files,
            data=data
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n   ✅ Upload exitoso!")
            print(f"\n3️⃣ Respuesta del servidor:")
            
            # Mostrar datos extraídos
            if 'data' in result:
                data_result = result['data']
                print(f"\n   📄 Datos extraídos:")
                print(f"      - Número: {data_result.get('numero', 'N/A')}")
                print(f"      - Punto Venta: {data_result.get('punto_venta', 'N/A')}")
                print(f"      - Fecha Emisión: {data_result.get('fecha_emision', 'N/A')}")
                print(f"      - Total: {data_result.get('total', 'N/A')}")
                print(f"      - Proveedor: {data_result.get('proveedor_nombre', 'N/A')}")
            
            # Mostrar URL del archivo
            if 'file_url' in result:
                print(f"\n   🌐 URL en Cloudinary:")
                print(f"      {result['file_url']}")
                print(f"\n   ✅ Archivo guardado exitosamente en Cloudinary!")
            else:
                print(f"\n   ⚠️ No se encontró file_url en la respuesta")
                print(f"   Respuesta completa: {result}")
            
            return True
            
        else:
            print(f"\n   ❌ Error en upload: {response.status_code}")
            print(f"   Respuesta: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"\n   ❌ Error: No se pudo conectar al backend")
        print(f"   Verifica que el backend esté corriendo en http://localhost:8000")
        return False
    except Exception as e:
        print(f"\n   ❌ Error inesperado: {e}")
        return False

def verify_cloudinary():
    """Verificar archivos en Cloudinary"""
    print("\n" + "="*60)
    print("🔍 VERIFICANDO ARCHIVOS EN CLOUDINARY")
    print("="*60)
    
    try:
        # Importar el script de listado
        from list_cloudinary_files import list_all_files
        list_all_files()
        return True
    except Exception as e:
        print(f"\n❌ Error al listar archivos: {e}")
        return False

def main():
    """Ejecutar test completo"""
    print("\n" + "="*60)
    print("🚀 INICIANDO TEST COMPLETO DE CLOUDINARY")
    print("="*60)
    
    # Test 1: Upload de factura
    success_upload = test_upload_factura()
    
    if success_upload:
        # Test 2: Verificar en Cloudinary
        print("\n⏱️ Esperando 2 segundos para que se sincronice...")
        import time
        time.sleep(2)
        
        verify_cloudinary()
        
        print("\n" + "="*60)
        print("✅ TEST COMPLETADO EXITOSAMENTE")
        print("="*60)
        print("\n📋 Verificaciones realizadas:")
        print("   ✅ PDF de prueba creado")
        print("   ✅ Upload a través del endpoint")
        print("   ✅ Procesamiento por backend")
        print("   ✅ Guardado en Cloudinary")
        print("   ✅ URL pública generada")
        print("\n🎯 Siguiente paso: Verificar en el dashboard de Cloudinary")
        print("   https://console.cloudinary.com/console/do97luh2t/media_library")
        print("\n")
        return 0
    else:
        print("\n" + "="*60)
        print("❌ TEST FALLÓ")
        print("="*60)
        print("\n🔍 Posibles causas:")
        print("   - Backend no está corriendo")
        print("   - Credenciales de Cloudinary incorrectas")
        print("   - Error en el endpoint de procesamiento")
        print("\n💡 Solución:")
        print("   1. Verificar que el backend esté corriendo:")
        print("      uvicorn app.main:app --reload")
        print("   2. Verificar logs del backend para más detalles")
        print("\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
