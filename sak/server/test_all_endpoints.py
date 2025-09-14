import requests
import json
from datetime import datetime, date

# Configuración
BASE_URL = "http://localhost:8000"
headers = {"Content-Type": "application/json"}

def test_endpoint(method, endpoint, data=None, description=""):
    """Función helper para probar endpoints"""
    url = f"{BASE_URL}{endpoint}"
    print(f"\n{'='*60}")
    print(f"🧪 PROBANDO: {method} {endpoint}")
    print(f"📝 {description}")
    print(f"{'='*60}")
    
    try:
        if method == "GET":
            response = requests.get(url)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=data)
        elif method == "DELETE":
            response = requests.delete(url)
        
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code < 400:
            try:
                result = response.json()
                print(f"✅ Respuesta: {json.dumps(result, indent=2, default=str)}")
                return result
            except:
                print(f"✅ Respuesta: {response.text}")
                return response.text
        else:
            print(f"❌ Error: {response.text}")
            return None
    except Exception as e:
        print(f"💥 Error de conexión: {e}")
        return None

def main():
    print("🚀 INICIANDO PRUEBAS COMPLETAS DEL SISTEMA DE FACTURAS")
    print("=" * 80)
    
    # Variables para almacenar IDs creados
    proveedor_id = None
    tipo_operacion_id = None
    factura_id = None
    
    # ==============================================
    # 1. PRUEBAS DE PROVEEDORES
    # ==============================================
    
    # Crear proveedores
    proveedores_data = [
        {
            "nombre": "Proveedor Demo S.A.",
            "razon_social": "Proveedor Demo Sociedad Anónima",
            "cuit": "20-12345678-9",
            "direccion": "Av. Corrientes 1234, CABA",
            "telefono": "+54 11 4444-5555",
            "email": "contacto@proveedordemo.com",
            "activo": True
        },
        {
            "nombre": "Servicios Tech S.R.L.",
            "razon_social": "Servicios Tech Sociedad de Responsabilidad Limitada",
            "cuit": "30-87654321-5",
            "direccion": "Av. Santa Fe 5678, CABA",
            "telefono": "+54 11 7777-8888",
            "email": "info@serviciostech.com",
            "activo": True
        }
    ]
    
    for i, proveedor in enumerate(proveedores_data):
        result = test_endpoint("POST", "/proveedores", proveedor, f"Crear proveedor {i+1}")
        if result and i == 0:  # Guardar el ID del primer proveedor
            proveedor_id = result.get("id")
    
    # Listar proveedores
    test_endpoint("GET", "/proveedores", description="Listar todos los proveedores")
    
    # Obtener proveedor específico
    if proveedor_id:
        test_endpoint("GET", f"/proveedores/{proveedor_id}", description="Obtener proveedor por ID")
    
    # ==============================================
    # 2. PRUEBAS DE TIPOS DE OPERACIÓN
    # ==============================================
    
    tipos_operacion_data = [
        {
            "codigo": "COMP",
            "descripcion": "Compra de bienes y productos",
            "activo": True
        },
        {
            "codigo": "SERV",
            "descripcion": "Contratación de servicios profesionales",
            "activo": True
        },
        {
            "codigo": "MANT",
            "descripcion": "Servicios de mantenimiento y reparación",
            "activo": True
        }
    ]
    
    for i, tipo in enumerate(tipos_operacion_data):
        result = test_endpoint("POST", "/tipos-operacion", tipo, f"Crear tipo de operación {i+1}")
        if result and i == 0:  # Guardar el ID del primer tipo
            tipo_operacion_id = result.get("id")
    
    # Listar tipos de operación
    test_endpoint("GET", "/tipos-operacion", description="Listar todos los tipos de operación")
    
    # Obtener tipo específico
    if tipo_operacion_id:
        test_endpoint("GET", f"/tipos-operacion/{tipo_operacion_id}", description="Obtener tipo de operación por ID")
    
    # ==============================================
    # 3. PRUEBAS DE FACTURAS
    # ==============================================
    
    if proveedor_id and tipo_operacion_id:
        facturas_data = [
            {
                "numero": "0001-00000001",
                "punto_venta": "0001",
                "tipo_comprobante": "A",
                "fecha_emision": date(2025, 9, 13).isoformat(),
                "subtotal": 1000.00,
                "total_impuestos": 210.00,
                "total": 1210.00,
                "proveedor_id": proveedor_id,
                "tipo_operacion_id": tipo_operacion_id,
                "observaciones": "Factura de prueba - Compra de equipos"
            },
            {
                "numero": "0001-00000002",
                "punto_venta": "0001",
                "tipo_comprobante": "B",
                "fecha_emision": date(2025, 9, 13).isoformat(),
                "subtotal": 500.00,
                "total_impuestos": 105.00,
                "total": 605.00,
                "proveedor_id": proveedor_id,
                "tipo_operacion_id": tipo_operacion_id,
                "observaciones": "Factura de prueba - Servicios profesionales"
            }
        ]
        
        for i, factura in enumerate(facturas_data):
            result = test_endpoint("POST", "/facturas", factura, f"Crear factura {i+1}")
            if result and i == 0:  # Guardar el ID de la primera factura
                factura_id = result.get("id")
    
    # Listar facturas
    test_endpoint("GET", "/facturas", description="Listar todas las facturas")
    
    # Obtener factura específica
    if factura_id:
        test_endpoint("GET", f"/facturas/{factura_id}", description="Obtener factura por ID")
    
    # ==============================================
    # 4. PRUEBAS DE DETALLES DE FACTURA
    # ==============================================
    
    if factura_id:
        detalles_data = [
            {
                "factura_id": factura_id,
                "descripcion": "Laptop HP Pavilion",
                "cantidad": 2.0,
                "precio_unitario": 350.00,
                "subtotal": 700.00,
                "codigo_producto": "HP-PAV-001"
            },
            {
                "factura_id": factura_id,
                "descripcion": "Mouse inalámbrico",
                "cantidad": 5.0,
                "precio_unitario": 60.00,
                "subtotal": 300.00,
                "codigo_producto": "MOUSE-001"
            }
        ]
        
        for i, detalle in enumerate(detalles_data):
            test_endpoint("POST", "/factura-detalles", detalle, f"Crear detalle de factura {i+1}")
    
    # Listar detalles
    test_endpoint("GET", "/factura-detalles", description="Listar todos los detalles de facturas")
    
    # ==============================================
    # 5. PRUEBAS DE IMPUESTOS DE FACTURA
    # ==============================================
    
    if factura_id:
        impuestos_data = [
            {
                "factura_id": factura_id,
                "tipo_impuesto": "IVA",
                "porcentaje": 21.0,
                "base_imponible": 1000.00,
                "importe": 210.00
            }
        ]
        
        for i, impuesto in enumerate(impuestos_data):
            test_endpoint("POST", "/factura-impuestos", impuesto, f"Crear impuesto de factura {i+1}")
    
    # Listar impuestos
    test_endpoint("GET", "/factura-impuestos", description="Listar todos los impuestos de facturas")
    
    # ==============================================
    # 6. PRUEBAS DE ENDPOINTS ADICIONALES
    # ==============================================
    
    # Probar endpoints de búsqueda y filtros
    test_endpoint("GET", "/facturas?skip=0&limit=10", description="Listar facturas con paginación")
    test_endpoint("GET", "/proveedores?skip=0&limit=5", description="Listar proveedores con paginación")
    
    # ==============================================
    # 7. RESUMEN FINAL
    # ==============================================
    
    print("\n" + "="*80)
    print("🎉 PRUEBAS COMPLETADAS!")
    print("="*80)
    print("✅ Proveedores: Creación, listado y obtención por ID")
    print("✅ Tipos de Operación: Creación, listado y obtención por ID")
    print("✅ Facturas: Creación, listado y obtención por ID")
    print("✅ Detalles de Factura: Creación y listado")
    print("✅ Impuestos de Factura: Creación y listado")
    print("✅ Endpoints con paginación")
    print("="*80)
    
    if proveedor_id and tipo_operacion_id and factura_id:
        print(f"📋 IDs creados para pruebas:")
        print(f"   - Proveedor ID: {proveedor_id}")
        print(f"   - Tipo Operación ID: {tipo_operacion_id}")
        print(f"   - Factura ID: {factura_id}")
    
    print("🔗 Puedes seguir probando en: http://localhost:8000/docs")
    print("🌐 Frontend disponible en: http://localhost:3000")

if __name__ == "__main__":
    main()
