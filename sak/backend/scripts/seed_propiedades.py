"""
Seed para completar campos nuevos de propiedades existentes.

IMPORTANTE: NO crea propiedades nuevas, solo completa campos vacíos.

Reglas:
1. Propiedades tipo "terreno" → tipo_operacion = "emprendimiento"
2. Resto de propiedades → tipo_operacion = "alquiler" por defecto
3. Solo terrenos se asignan a emprendimientos
4. Completa costos y precios estimados si están vacíos

Uso:
    python scripts/seed_propiedades.py
"""
import os
from decimal import Decimal
from pathlib import Path

from sqlmodel import Session, select

BACKEND_ROOT = Path(__file__).resolve().parent.parent

import sys

sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

from app.db import engine
from app.models import (
    CRMTipoOperacion,
    Emprendimiento,
    Moneda,
    Propiedad,
    User,
)


def get_default_ids(session: Session) -> dict:
    """Obtiene IDs de catálogos necesarios."""
    tipo_alquiler = session.exec(select(CRMTipoOperacion).where(CRMTipoOperacion.codigo == "alquiler")).first()
    tipo_emprendimiento = session.exec(select(CRMTipoOperacion).where(CRMTipoOperacion.codigo == "emprendimiento")).first()
    dolar = session.exec(select(Moneda).where(Moneda.codigo == "USD")).first()
    peso = session.exec(select(Moneda).where(Moneda.codigo == "ARS")).first()
    responsable = session.exec(select(User)).first()

    # Emprendimiento demo (solo si no existe ninguno)
    emprendimiento = session.exec(select(Emprendimiento)).first()
    if not emprendimiento and responsable:
        emprendimiento = Emprendimiento(
            nombre="Emprendimiento General",
            descripcion="Emprendimiento para propiedades tipo terreno",
            estado="planificacion",
            responsable_id=responsable.id,
        )
        session.add(emprendimiento)
        session.commit()
        session.refresh(emprendimiento)
        print(f"✅ Creado emprendimiento demo: {emprendimiento.nombre}")

    return {
        "tipo_alquiler_id": tipo_alquiler.id if tipo_alquiler else None,
        "tipo_emprendimiento_id": tipo_emprendimiento.id if tipo_emprendimiento else None,
        "emprendimiento_id": emprendimiento.id if emprendimiento else None,
        "peso_id": peso.id if peso else None,
        "dolar_id": dolar.id if dolar else None,
    }


def seed_propiedades(session: Session) -> None:
    """Completa campos nuevos en propiedades existentes."""
    ids = get_default_ids(session)
    
    if not ids["tipo_alquiler_id"] or not ids["tipo_emprendimiento_id"]:
        print("❌ ERROR: No se encontraron tipos de operación. Ejecuta seed_crm.py primero.")
        return
    
    propiedades = session.exec(select(Propiedad)).all()
    total = len(propiedades)
    
    print(f"\n📊 Procesando {total} propiedades...")
    print("="*60)
    
    terrenos = 0
    no_terrenos = 0
    ya_completas = 0
    
    for prop in propiedades:
        cambios = []
        
        # Regla 1: Asignar tipo de operación según tipo de propiedad
        if prop.tipo_operacion_id is None:
            if prop.tipo and prop.tipo.lower() == "terreno":
                prop.tipo_operacion_id = ids["tipo_emprendimiento_id"]
                cambios.append("tipo_op=emprendimiento")
                terrenos += 1
            else:
                prop.tipo_operacion_id = ids["tipo_alquiler_id"]
                cambios.append("tipo_op=alquiler")
                no_terrenos += 1
        
        # Regla 2: Asignar emprendimiento SOLO a terrenos
        if prop.emprendimiento_id is None:
            if prop.tipo and prop.tipo.lower() == "terreno" and ids["emprendimiento_id"]:
                prop.emprendimiento_id = ids["emprendimiento_id"]
                cambios.append("emprendimiento=asignado")
        
        # Regla 3: Completar costo si está vacío
        if prop.costo_propiedad is None and ids["peso_id"]:
            prop.costo_propiedad = Decimal("1000000")
            prop.costo_moneda_id = ids["peso_id"]
            cambios.append("costo=ARS 1M")
        
        # Regla 4: Completar precio estimado si está vacío
        if prop.precio_venta_estimado is None and ids["dolar_id"]:
            prop.precio_venta_estimado = Decimal("150000")
            prop.precio_moneda_id = ids["dolar_id"]
            cambios.append("precio=USD 150K")
        
        if cambios:
            tipo_display = prop.tipo or "sin_tipo"
            print(f"  ✅ Propiedad #{prop.id} ({tipo_display}): {', '.join(cambios)}")
        else:
            ya_completas += 1
    
    session.commit()
    
    print("="*60)
    print(f"\n📋 Resumen:")
    print(f"  • Terrenos → emprendimiento: {terrenos}")
    print(f"  • No terrenos → alquiler: {no_terrenos}")
    print(f"  • Ya completas: {ya_completas}")
    print(f"  • Total procesadas: {total}")
    print(f"\n✅ Seed completado exitosamente")


def main() -> None:
    db_url = os.getenv("DATABASE_URL")
    print("="*60)
    print("SEED PROPIEDADES - Completar campos CRM")
    print("="*60)
    print(f"DATABASE_URL: {db_url[:50]}..." if db_url else "No DATABASE_URL")
    
    with Session(engine) as session:
        seed_propiedades(session)


if __name__ == "__main__":
    main()
