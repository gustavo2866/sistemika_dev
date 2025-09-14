import requests
import json
from datetime import date

# Configuración
BASE_URL = "http://localhost:8000"
headers = {"Content-Type": "application/json"}

def test_facturas():
    print("🧪 PROBANDO CREACIÓN DE FACTURAS")
    print("="*50)
    
    # Datos de factura usando IDs existentes
    factura_data = {
        "numero": "0001-00000004",
        "punto_venta": "0001", 
        "tipo_comprobante": "A",
        "fecha_emision": "2025-09-13",
        "subtotal": 2000.00,
        "total_impuestos": 420.00,
        "total": 2420.00,
        "proveedor_id": 1,  # Usamos el ID del proveedor existente
        "tipo_operacion_id": 1,  # Usamos el ID del tipo de operación existente
        "observaciones": "Factura completa con detalles e impuestos"
    }
    
    # Crear factura
    try:
        response = requests.post(f"{BASE_URL}/facturas", headers=headers, json=factura_data)
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code < 400:
            result = response.json()
            print(f"✅ Factura creada: {json.dumps(result, indent=2, default=str)}")
            factura_id = result.get("id")
            
            # Crear detalles de factura
            if factura_id:
                print(f"\n🧪 CREANDO DETALLES PARA FACTURA ID: {factura_id}")
                
                detalles = [
                    {
                        "factura_id": factura_id,
                        "descripcion": "Servicio de consultoría especializada",
                        "cantidad": 2.0,
                        "precio_unitario": 1000.00,
                        "subtotal": 2000.00,
                        "porcentaje_iva": 21.0,
                        "importe_iva": 420.0,
                        "total_linea": 2420.0,
                        "orden": 1,
                        "codigo_producto": "CONS-002"
                    }
                ]
                
                for detalle in detalles:
                    response = requests.post(f"{BASE_URL}/factura-detalles", headers=headers, json=detalle)
                    if response.status_code < 400:
                        print(f"✅ Detalle creado: {response.json()}")
                    else:
                        print(f"❌ Error creando detalle: {response.text}")
                
                # Crear impuestos de factura
                print(f"\n🧪 CREANDO IMPUESTOS PARA FACTURA ID: {factura_id}")
                
                impuestos = [
                    {
                        "factura_id": factura_id,
                        "tipo_impuesto": "IVA",
                        "descripcion": "Impuesto al Valor Agregado 21%",
                        "porcentaje": 21.0,
                        "base_imponible": 2000.00,
                        "importe": 420.00
                    }
                ]
                
                for impuesto in impuestos:
                    response = requests.post(f"{BASE_URL}/factura-impuestos", headers=headers, json=impuesto)
                    if response.status_code < 400:
                        print(f"✅ Impuesto creado: {response.json()}")
                    else:
                        print(f"❌ Error creando impuesto: {response.text}")
                
                # Obtener factura completa
                print(f"\n🧪 OBTENIENDO FACTURA COMPLETA")
                response = requests.get(f"{BASE_URL}/facturas/{factura_id}")
                if response.status_code < 400:
                    print(f"✅ Factura completa: {json.dumps(response.json(), indent=2, default=str)}")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"💥 Error: {e}")

def test_endpoints_get():
    print(f"\n🧪 PROBANDO TODOS LOS ENDPOINTS GET")
    print("="*50)
    
    endpoints = [
        "/proveedores",
        "/tipos-operacion", 
        "/facturas",
        "/factura-detalles",
        "/factura-impuestos"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}")
            print(f"\n📊 GET {endpoint} - Status: {response.status_code}")
            if response.status_code < 400:
                data = response.json()
                print(f"✅ Registros encontrados: {len(data)}")
                if data:
                    print(f"📝 Primer registro: {json.dumps(data[0], indent=2, default=str)}")
            else:
                print(f"❌ Error: {response.text}")
        except Exception as e:
            print(f"💥 Error: {e}")

if __name__ == "__main__":
    test_facturas()
    test_endpoints_get()
    print("\n🎉 PRUEBAS COMPLETAS FINALIZADAS!")
    print("🔗 Swagger UI: http://localhost:8000/docs")
    print("🌐 Frontend: http://localhost:3000")
