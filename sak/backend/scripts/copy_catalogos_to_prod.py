"""
Exportar catálogos de base local y copiarlos a producción (Neon)
"""
import os
import sys
import subprocess
from pathlib import Path
from sqlmodel import Session, select
import json

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv
load_dotenv(BACKEND_ROOT / ".env")

from app.db import engine
from app.models import (
    CRMCondicionPago,
    CRMMotivoEvento,
    CRMMotivoPerdida,
    CRMOrigenLead,
    CRMTipoEvento,
    CRMTipoOperacion,
    Moneda,
)

def get_production_database_url():
    """Obtener DATABASE_URL de producción desde GCP Secret Manager"""
    try:
        result = subprocess.run(
            ["powershell", "-Command", 
             "gcloud secrets versions access latest --secret=DATABASE_URL --project=sak-wcl"],
            capture_output=True,
            text=True,
            check=True,
            shell=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ Error al obtener DATABASE_URL: {e}")
        return None

def export_catalogos_from_local():
    """Exportar todos los catálogos de la base local"""
    print("\n" + "="*70)
    print("EXPORTANDO CATÁLOGOS DE BASE LOCAL")
    print("="*70)
    
    catalogos_data = {}
    
    with Session(engine) as session:
        # Tipos de Operación
        tipos_op = session.exec(select(CRMTipoOperacion)).all()
        catalogos_data['tipos_operacion'] = [
            {"codigo": t.codigo, "nombre": t.nombre, "descripcion": t.descripcion}
            for t in tipos_op
        ]
        print(f"✅ Tipos de Operación: {len(tipos_op)} registros")
        
        # Motivos de Pérdida
        motivos_perd = session.exec(select(CRMMotivoPerdida)).all()
        catalogos_data['motivos_perdida'] = [
            {"codigo": m.codigo, "nombre": m.nombre, "descripcion": m.descripcion}
            for m in motivos_perd
        ]
        print(f"✅ Motivos de Pérdida: {len(motivos_perd)} registros")
        
        # Condiciones de Pago
        condiciones = session.exec(select(CRMCondicionPago)).all()
        catalogos_data['condiciones_pago'] = [
            {"codigo": c.codigo, "nombre": c.nombre, "descripcion": c.descripcion}
            for c in condiciones
        ]
        print(f"✅ Condiciones de Pago: {len(condiciones)} registros")
        
        # Tipos de Evento
        tipos_ev = session.exec(select(CRMTipoEvento)).all()
        catalogos_data['tipos_evento'] = [
            {"codigo": t.codigo, "nombre": t.nombre, "descripcion": t.descripcion}
            for t in tipos_ev
        ]
        print(f"✅ Tipos de Evento: {len(tipos_ev)} registros")
        
        # Motivos de Evento
        motivos_ev = session.exec(select(CRMMotivoEvento)).all()
        catalogos_data['motivos_evento'] = [
            {"codigo": m.codigo, "nombre": m.nombre, "descripcion": m.descripcion}
            for m in motivos_ev
        ]
        print(f"✅ Motivos de Evento: {len(motivos_ev)} registros")
        
        # Orígenes de Lead
        origenes = session.exec(select(CRMOrigenLead)).all()
        catalogos_data['origenes_lead'] = [
            {"codigo": o.codigo, "nombre": o.nombre, "descripcion": o.descripcion}
            for o in origenes
        ]
        print(f"✅ Orígenes de Lead: {len(origenes)} registros")
        
        # Monedas
        monedas = session.exec(select(Moneda)).all()
        catalogos_data['monedas'] = [
            {
                "codigo": m.codigo, 
                "nombre": m.nombre, 
                "simbolo": m.simbolo,
                "es_moneda_base": m.es_moneda_base
            }
            for m in monedas
        ]
        print(f"✅ Monedas: {len(monedas)} registros")
    
    return catalogos_data

def import_catalogos_to_production(catalogos_data):
    """Importar catálogos a la base de producción"""
    print("\n" + "="*70)
    print("IMPORTANDO CATÁLOGOS A PRODUCCIÓN (NEON)")
    print("="*70)
    
    # Obtener DATABASE_URL de producción
    prod_db_url = get_production_database_url()
    if not prod_db_url:
        print("❌ No se pudo obtener la URL de la base de producción")
        return False
    
    # Crear engine temporal para producción
    from sqlalchemy import create_engine
    prod_engine = create_engine(prod_db_url)
    
    try:
        with Session(prod_engine) as session:
            # Tipos de Operación
            for item in catalogos_data['tipos_operacion']:
                existing = session.exec(
                    select(CRMTipoOperacion).where(CRMTipoOperacion.codigo == item['codigo'])
                ).first()
                if not existing:
                    obj = CRMTipoOperacion(**item)
                    session.add(obj)
            session.commit()
            print(f"✅ Tipos de Operación: {len(catalogos_data['tipos_operacion'])} procesados")
            
            # Motivos de Pérdida
            for item in catalogos_data['motivos_perdida']:
                existing = session.exec(
                    select(CRMMotivoPerdida).where(CRMMotivoPerdida.codigo == item['codigo'])
                ).first()
                if not existing:
                    obj = CRMMotivoPerdida(**item)
                    session.add(obj)
            session.commit()
            print(f"✅ Motivos de Pérdida: {len(catalogos_data['motivos_perdida'])} procesados")
            
            # Condiciones de Pago
            for item in catalogos_data['condiciones_pago']:
                existing = session.exec(
                    select(CRMCondicionPago).where(CRMCondicionPago.codigo == item['codigo'])
                ).first()
                if not existing:
                    obj = CRMCondicionPago(**item)
                    session.add(obj)
            session.commit()
            print(f"✅ Condiciones de Pago: {len(catalogos_data['condiciones_pago'])} procesados")
            
            # Tipos de Evento
            for item in catalogos_data['tipos_evento']:
                existing = session.exec(
                    select(CRMTipoEvento).where(CRMTipoEvento.codigo == item['codigo'])
                ).first()
                if not existing:
                    obj = CRMTipoEvento(**item)
                    session.add(obj)
            session.commit()
            print(f"✅ Tipos de Evento: {len(catalogos_data['tipos_evento'])} procesados")
            
            # Motivos de Evento
            for item in catalogos_data['motivos_evento']:
                existing = session.exec(
                    select(CRMMotivoEvento).where(CRMMotivoEvento.codigo == item['codigo'])
                ).first()
                if not existing:
                    obj = CRMMotivoEvento(**item)
                    session.add(obj)
            session.commit()
            print(f"✅ Motivos de Evento: {len(catalogos_data['motivos_evento'])} procesados")
            
            # Orígenes de Lead
            for item in catalogos_data['origenes_lead']:
                existing = session.exec(
                    select(CRMOrigenLead).where(CRMOrigenLead.codigo == item['codigo'])
                ).first()
                if not existing:
                    obj = CRMOrigenLead(**item)
                    session.add(obj)
            session.commit()
            print(f"✅ Orígenes de Lead: {len(catalogos_data['origenes_lead'])} procesados")
            
            # Monedas
            for item in catalogos_data['monedas']:
                existing = session.exec(
                    select(Moneda).where(Moneda.codigo == item['codigo'])
                ).first()
                if not existing:
                    obj = Moneda(**item)
                    session.add(obj)
            session.commit()
            print(f"✅ Monedas: {len(catalogos_data['monedas'])} procesados")
            
        print("\n✅ Todos los catálogos fueron importados exitosamente a producción")
        return True
        
    except Exception as e:
        print(f"\n❌ Error al importar: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("="*70)
    print("COPIAR CATÁLOGOS DE LOCAL A PRODUCCIÓN")
    print("="*70)
    
    # 1. Exportar de local
    catalogos_data = export_catalogos_from_local()
    
    if not catalogos_data:
        print("❌ No hay datos para exportar")
        return
    
    # Mostrar resumen
    print("\n" + "="*70)
    print("RESUMEN DE DATOS A COPIAR")
    print("="*70)
    for key, items in catalogos_data.items():
        print(f"  {key}: {len(items)} registros")
    
    # Confirmar
    print("\n⚠️  Se copiarán estos datos a PRODUCCIÓN (Neon)")
    respuesta = input("¿Continuar? (s/n): ")
    
    if respuesta.lower() != 's':
        print("❌ Operación cancelada")
        return
    
    # 2. Importar a producción
    success = import_catalogos_to_production(catalogos_data)
    
    if success:
        print("\n" + "="*70)
        print("✅ PROCESO COMPLETADO EXITOSAMENTE")
        print("="*70)
    else:
        print("\n" + "="*70)
        print("❌ PROCESO TERMINÓ CON ERRORES")
        print("="*70)

if __name__ == "__main__":
    main()
