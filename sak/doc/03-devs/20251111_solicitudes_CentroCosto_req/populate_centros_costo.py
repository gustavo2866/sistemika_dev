"""
Script para popular centros de costo desde propiedades y proyectos existentes
Ejecutar DESPUÉS de la migración Alembic

Ubicación: doc/03-devs/20251111_solicitudes_CentroCosto_req/populate_centros_costo.py
Ejecución: python doc/03-devs/20251111_solicitudes_CentroCosto_req/populate_centros_costo.py
"""
import sys
import os
from pathlib import Path

# Agregar el directorio backend al path para imports
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Importar después de agregar al path para evitar errores de Pylance
from sqlmodel import Session, select  # type: ignore
from app.db import engine  # type: ignore
from app.models import CentroCosto, Propiedad, Proyecto  # type: ignore

def populate_centros_costo():
    """Poblar centros de costo desde propiedades y proyectos existentes"""
    with Session(engine) as session:
        print("🚀 Iniciando población de centros de costo...")
        
        # Verificar cuántos centros de costo ya existen
        existing_count = len(session.exec(select(CentroCosto)).all())
        print(f"📊 Centros de costo existentes: {existing_count}")
        
        if existing_count > 1:
            print("⚠️  Ya existen centros de costo. ¿Desea continuar agregando más? (s/n)")
            response = input().lower()
            if response != 's':
                print("❌ Operación cancelada")
                return
        
        created_count = 0
        
        # 1. Crear centro de costo por cada propiedad
        print("\n📋 Procesando propiedades...")
        propiedades = session.exec(select(Propiedad)).all()
        for prop in propiedades:
            # Verificar si ya existe un centro de costo para esta propiedad
            existing = session.exec(
                select(CentroCosto).where(
                    CentroCosto.nombre == f"Propiedad - {prop.nombre}"
                )
            ).first()
            
            if existing:
                print(f"  ⏭️  Ya existe: {existing.nombre}")
                continue
            
            centro = CentroCosto(
                nombre=f"Propiedad - {prop.nombre}",
                tipo="Propiedad",
                codigo_contable=f"PROP-{prop.id:04d}",
                descripcion=f"Centro de costo para propiedad {prop.nombre}",
                activo=True
            )
            session.add(centro)
            created_count += 1
            print(f"  ✅ Creado: {centro.nombre} ({centro.codigo_contable})")
        
        # 2. Crear centro de costo por cada proyecto
        print("\n📋 Procesando proyectos...")
        proyectos = session.exec(select(Proyecto)).all()
        for proy in proyectos:
            # Verificar si ya existe un centro de costo para este proyecto
            existing = session.exec(
                select(CentroCosto).where(
                    CentroCosto.nombre == f"Proyecto - {proy.nombre}"
                )
            ).first()
            
            if existing:
                print(f"  ⏭️  Ya existe: {existing.nombre}")
                continue
            
            centro = CentroCosto(
                nombre=f"Proyecto - {proy.nombre}",
                tipo="Proyecto",
                codigo_contable=f"PROY-{proy.id:04d}",
                descripcion=f"Centro de costo para proyecto {proy.nombre}",
                activo=True
            )
            session.add(centro)
            created_count += 1
            print(f"  ✅ Creado: {centro.nombre} ({centro.codigo_contable})")
        
        # 3. Crear 4 centros de costo generales (si no existen)
        print("\n📋 Procesando centros de costo generales...")
        generales = [
            ("Administración General", "GEN-0001", "Gastos administrativos generales de la empresa"),
            ("Marketing y Ventas", "GEN-0002", "Gastos de marketing, publicidad y equipo comercial"),
            ("Recursos Humanos", "GEN-0003", "Gastos de RRHH, capacitación y desarrollo"),
            ("Infraestructura IT", "GEN-0004", "Gastos de tecnología, sistemas y soporte técnico"),
        ]
        
        for nombre, codigo, descripcion in generales:
            # Verificar si ya existe
            existing = session.exec(
                select(CentroCosto).where(CentroCosto.nombre == nombre)
            ).first()
            
            if existing:
                print(f"  ⏭️  Ya existe: {existing.nombre}")
                continue
            
            centro = CentroCosto(
                nombre=nombre,
                tipo="General",
                codigo_contable=codigo,
                descripcion=descripcion,
                activo=True
            )
            session.add(centro)
            created_count += 1
            print(f"  ✅ Creado: {centro.nombre} ({centro.codigo_contable})")
        
        # Commit de todos los cambios
        session.commit()
        print(f"\n✅ Población completada exitosamente!")
        print(f"📊 Centros de costo creados en esta ejecución: {created_count}")
        
        # Mostrar resumen final
        total = session.exec(select(CentroCosto)).all()
        print(f"\n📊 Total centros de costo en base de datos: {len(total)}")
        print(f"   - Propiedades: {len([c for c in total if c.tipo == 'Propiedad'])}")
        print(f"   - Proyectos: {len([c for c in total if c.tipo == 'Proyecto'])}")
        print(f"   - Generales: {len([c for c in total if c.tipo == 'General'])}")


if __name__ == "__main__":
    try:
        populate_centros_costo()
    except Exception as e:
        print(f"\n❌ Error durante la población: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
