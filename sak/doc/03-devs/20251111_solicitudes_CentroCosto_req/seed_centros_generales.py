"""
Script para crear centros de costo generales adicionales si son necesarios
Ejecutar DESPUÉS de populate_centros_costo.py

Ubicación: doc/03-devs/20251111_solicitudes_CentroCosto_req/seed_centros_generales.py
Ejecución: python doc/03-devs/20251111_solicitudes_CentroCosto_req/seed_centros_generales.py
"""
import sys
import os
from pathlib import Path

# Agregar el directorio backend al path para imports
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Importar después de agregar al path
from sqlmodel import Session, select  # type: ignore
from app.db import engine  # type: ignore
from app.models import CentroCosto  # type: ignore


def seed_additional_centros():
    """Crear centros de costo adicionales para casos especiales"""
    with Session(engine) as session:
        print("🌱 Iniciando seed de centros de costo adicionales...")
        
        # Centros adicionales (agregar según necesidad del negocio)
        adicionales = [
            # Tipo Socios
            {
                "nombre": "Socio - Distribución Utilidades",
                "tipo": "Socios",
                "codigo_contable": "SOC-0001",
                "descripcion": "Centro de costo para distribución de utilidades a socios",
                "activo": True
            },
            # Tipo General adicionales
            {
                "nombre": "Mantenimiento y Reparaciones",
                "tipo": "General",
                "codigo_contable": "GEN-0005",
                "descripcion": "Gastos de mantenimiento general y reparaciones",
                "activo": True
            },
            {
                "nombre": "Servicios Públicos",
                "tipo": "General",
                "codigo_contable": "GEN-0006",
                "descripcion": "Gastos de luz, agua, gas y servicios públicos",
                "activo": True
            },
            {
                "nombre": "Seguros y Garantías",
                "tipo": "General",
                "codigo_contable": "GEN-0007",
                "descripcion": "Gastos de seguros y garantías",
                "activo": True
            },
            {
                "nombre": "Capacitación y Desarrollo",
                "tipo": "General",
                "codigo_contable": "GEN-0008",
                "descripcion": "Gastos de capacitación y desarrollo de personal",
                "activo": True
            },
            {
                "nombre": "Viáticos y Movilidad",
                "tipo": "General",
                "codigo_contable": "GEN-0009",
                "descripcion": "Gastos de viajes, movilidad y viáticos",
                "activo": True
            },
        ]
        
        created = 0
        skipped = 0
        
        for data in adicionales:
            # Verificar si ya existe
            existing = session.exec(
                select(CentroCosto).where(CentroCosto.nombre == data["nombre"])
            ).first()
            
            if existing:
                print(f"  ⏭️  Ya existe: {existing.nombre} ({existing.codigo_contable})")
                skipped += 1
                continue
            
            centro = CentroCosto(**data)
            session.add(centro)
            created += 1
            print(f"  ✅ Creado: {centro.nombre} ({centro.codigo_contable})")
        
        if created > 0:
            session.commit()
            print(f"\n✅ Seed completado exitosamente!")
            print(f"   📊 Centros creados: {created}")
            print(f"   ⏭️  Centros existentes: {skipped}")
        else:
            print("\n✅ Todos los centros adicionales ya existían")
        
        # Mostrar resumen por tipo
        print("\n📊 Resumen de centros de costo por tipo:")
        tipos = session.exec(
            select(CentroCosto.tipo, CentroCosto.id).where(CentroCosto.deleted_at.is_(None))
        ).all()
        
        tipo_count = {}
        for tipo, _ in tipos:
            tipo_count[tipo] = tipo_count.get(tipo, 0) + 1
        
        for tipo, count in sorted(tipo_count.items()):
            print(f"   - {tipo}: {count}")


if __name__ == "__main__":
    try:
        seed_additional_centros()
    except Exception as e:
        print(f"\n❌ Error durante seed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
