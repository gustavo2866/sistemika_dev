"""
Script para poblar la tabla po_invoice_status con los estados de facturas PO
"""

import sys
from pathlib import Path

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent))

from sqlmodel import Session, create_engine, select
from dotenv import load_dotenv
import os

from app.models.compras import PoInvoiceStatus

# Cargar variables de entorno
load_dotenv()

# Configurar conexión a la base de datos
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL no está configurada")

engine = create_engine(DATABASE_URL)

# Datos de estados de facturas PO
ESTADOS_DATA = [
    {
        "nombre": "borrador",
        "descripcion": "Factura en estado borrador",
        "orden": 1,
        "activo": True,
        "es_inicial": True,
        "es_final": False,
    },
    {
        "nombre": "confirmada", 
        "descripcion": "Factura confirmada",
        "orden": 2,
        "activo": True,
        "es_inicial": False,
        "es_final": False,
    },
    {
        "nombre": "registrada",
        "descripcion": "Factura registrada",
        "orden": 3,
        "activo": True,
        "es_inicial": False,
        "es_final": False,
    },
    {
        "nombre": "aprobada",
        "descripcion": "Factura aprobada",
        "orden": 4,
        "activo": True,
        "es_inicial": False,
        "es_final": False,
    },
    {
        "nombre": "rechazada",
        "descripcion": "Factura rechazada",
        "orden": 5,
        "activo": True,
        "es_inicial": False,
        "es_final": True,
    },
    {
        "nombre": "pagada",
        "descripcion": "Factura pagada",
        "orden": 6,
        "activo": True,
        "es_inicial": False,
        "es_final": True,
    },
]


def poblar_estados():
    """Poblar los estados de facturas PO"""
    
    with Session(engine) as session:
        print("🔄 Iniciando poblado de estados de facturas PO...")
        
        # Verificar si ya existen estados
        statement = select(PoInvoiceStatus)
        existing_estados = session.exec(statement).all()
        
        if existing_estados:
            print(f"⚠️  Ya existen {len(existing_estados)} estados en la tabla. ¿Continuar? (y/N)")
            response = input().lower()
            if response != 'y':
                print("❌ Operación cancelada")
                return
        
        # Poblar estados
        estados_creados = 0
        estados_existentes = 0
        
        for estado_data in ESTADOS_DATA:
            # Verificar si el estado ya existe
            statement = select(PoInvoiceStatus).where(PoInvoiceStatus.nombre == estado_data["nombre"])
            existing_estado = session.exec(statement).first()
            
            if existing_estado:
                print(f"⚠️  El estado '{estado_data['nombre']}' ya existe")
                estados_existentes += 1
                continue
            
            # Crear nuevo estado
            nuevo_estado = PoInvoiceStatus(**estado_data)
            session.add(nuevo_estado)
            print(f"✅ Creando estado: {estado_data['nombre']} (orden: {estado_data['orden']})")
            estados_creados += 1
        
        # Confirmar cambios
        session.commit()
        
        print(f"\n🎉 Proceso completado:")
        print(f"   • Estados creados: {estados_creados}")
        print(f"   • Estados que ya existían: {estados_existentes}")
        print(f"   • Total en tabla: {estados_creados + estados_existentes}")


def verificar_estados():
    """Verificar los estados creados"""
    
    with Session(engine) as session:
        statement = select(PoInvoiceStatus).order_by(PoInvoiceStatus.orden)
        estados = session.exec(statement).all()
        
        print("\n📋 Estados de facturas PO en la tabla:")
        print("-" * 60)
        for estado in estados:
            flags = []
            if estado.es_inicial:
                flags.append("INICIAL")
            if estado.es_final:
                flags.append("FINAL")
            if not estado.activo:
                flags.append("INACTIVO")
            
            flags_str = f" [{', '.join(flags)}]" if flags else ""
            print(f"ID: {estado.id:2d} | Orden: {estado.orden} | {estado.nombre:12s} | {estado.descripcion}{flags_str}")


if __name__ == "__main__":
    try:
        poblar_estados()
        verificar_estados()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()