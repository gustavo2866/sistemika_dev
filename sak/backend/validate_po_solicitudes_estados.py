"""
Script para validar los cambios en po_solicitudes estados
- Verificar que los estados pendientes se conviertan a borrador
- Verificar que la migración funcione correctamente
"""

import os
import sys
from pathlib import Path

# Agregar el directorio backend al path para importar módulos
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

from sqlmodel import Session, select
from app.database import engine
from app.models import PoSolicitud, EstadoPoSolicitud

def check_estados_before_migration():
    """Verificar estados antes de la migración"""
    with Session(engine) as session:
        # Contar registros por estado
        estados = {}
        for estado in ["pendiente", "borrador", "emitida", "aprobada", "rechazada", "en_proceso", "finalizada"]:
            count = session.exec(
                select(PoSolicitud).where(PoSolicitud.estado == estado)
            ).all()
            if count:
                estados[estado] = len(count)
        
        print("=== Estados antes de la migración ===")
        for estado, count in estados.items():
            print(f"{estado}: {count}")
        
        return estados

def check_estados_after_migration():
    """Verificar estados después de la migración"""
    with Session(engine) as session:
        # Contar registros por estado
        estados = {}
        for estado in [EstadoPoSolicitud.BORRADOR, EstadoPoSolicitud.EMITIDA, 
                      EstadoPoSolicitud.APROBADA, EstadoPoSolicitud.RECHAZADA,
                      EstadoPoSolicitud.EN_PROCESO, EstadoPoSolicitud.FINALIZADA]:
            count = session.exec(
                select(PoSolicitud).where(PoSolicitud.estado == estado.value)
            ).all()
            if count:
                estados[estado.value] = len(count)
        
        print("=== Estados después de la migración ===")
        for estado, count in estados.items():
            print(f"{estado}: {count}")
        
        # Verificar que no queden registros con estado 'pendiente'
        pendientes = session.exec(
            select(PoSolicitud).where(PoSolicitud.estado == "pendiente")
        ).all()
        
        if pendientes:
            print(f"❌ ERROR: Aún hay {len(pendientes)} registros con estado 'pendiente'")
            return False
        else:
            print("✅ No hay registros con estado 'pendiente'")
            return True

def check_enum_values():
    """Verificar que el enum tenga los valores correctos"""
    print("=== Valores del enum EstadoPoSolicitud ===")
    for estado in EstadoPoSolicitud:
        print(f"- {estado.name} = '{estado.value}'")
    
    # Verificar que no exista PENDIENTE
    try:
        pendiente = EstadoPoSolicitud.PENDIENTE
        print("❌ ERROR: El estado PENDIENTE aún existe en el enum")
        return False
    except AttributeError:
        print("✅ El estado PENDIENTE ya no existe en el enum")
        return True

def test_create_new_solicitud():
    """Probar crear una nueva solicitud para verificar el estado default"""
    with Session(engine) as session:
        # Crear solicitud sin especificar estado (debería usar default)
        nueva_solicitud = PoSolicitud(
            titulo="Test migración estados",
            tipo_solicitud_id=1,
            departamento_id=1,
            fecha_necesidad="2026-02-01",
            solicitante_id=1,
            centro_costo_id=1
        )
        
        session.add(nueva_solicitud)
        session.commit()
        session.refresh(nueva_solicitud)
        
        print(f"=== Nueva solicitud creada ===")
        print(f"ID: {nueva_solicitud.id}")
        print(f"Estado default: {nueva_solicitud.estado}")
        
        if nueva_solicitud.estado == "borrador":
            print("✅ El estado default es correcto: 'borrador'")
            return True
        else:
            print(f"❌ ERROR: El estado default debería ser 'borrador', pero es '{nueva_solicitud.estado}'")
            return False

if __name__ == "__main__":
    print("Validando cambios en po_solicitudes estados...")
    
    # 1. Verificar enum
    enum_ok = check_enum_values()
    
    # 2. Verificar estados actuales
    estados_antes = check_estados_before_migration()
    
    # 3. Verificar que no hay pendientes después de migración
    estados_ok = check_estados_after_migration()
    
    # 4. Probar crear nueva solicitud
    default_ok = test_create_new_solicitud()
    
    if enum_ok and estados_ok and default_ok:
        print("\n✅ Todos los tests pasaron correctamente")
    else:
        print("\n❌ Algunos tests fallaron")