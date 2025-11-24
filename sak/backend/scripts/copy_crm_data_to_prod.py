"""
Copiar datos CRM (contactos, oportunidades, eventos) de local a producción
Mantiene consistencia con propiedades existentes
"""
import sys
import subprocess
from pathlib import Path
from sqlmodel import Session, select
from datetime import datetime
from typing import Dict, List

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv
load_dotenv(BACKEND_ROOT / ".env")

from sqlalchemy import create_engine, text
from app.db import engine as local_engine
from app.models import (
    CRMContacto,
    CRMOportunidad,
    CRMEvento,
    CRMOportunidadLogEstado,
    Propiedad,
    User,
)

def get_production_database_url():
    """Obtener DATABASE_URL de producción"""
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

def export_contactos():
    """Exportar contactos de base local"""
    print("\n" + "="*70)
    print("EXPORTANDO CONTACTOS")
    print("="*70)
    
    with Session(local_engine) as session:
        contactos = session.exec(select(CRMContacto)).all()
        
        contactos_data = []
        for c in contactos:
            data = {
                'nombre_completo': c.nombre_completo,
                'email': c.email,
                'telefonos': c.telefonos,
                'origen_lead_id': c.origen_lead_id,
                'responsable_id': c.responsable_id,
                'notas': c.notas,
                '_original_id': c.id
            }
            # Agregar campos opcionales si existen
            if hasattr(c, 'red_social'):
                data['red_social'] = c.red_social
            if hasattr(c, 'created_at') and c.created_at:
                data['created_at'] = c.created_at
            if hasattr(c, 'updated_at') and c.updated_at:
                data['updated_at'] = c.updated_at
                
            contactos_data.append(data)
        
        print(f"✅ {len(contactos_data)} contactos exportados")
        return contactos_data

def export_oportunidades():
    """Exportar oportunidades de base local"""
    print("\n" + "="*70)
    print("EXPORTANDO OPORTUNIDADES")
    print("="*70)
    
    with Session(local_engine) as session:
        oportunidades = session.exec(select(CRMOportunidad)).all()
        
        opor_data = []
        for o in oportunidades:
            data = {
                'contacto_id': o.contacto_id,
                'tipo_operacion_id': o.tipo_operacion_id,
                'responsable_id': o.responsable_id,
                'estado': o.estado,
                'fecha_estado': o.fecha_estado,
                '_original_id': o.id
            }
            
            # notas si existe
            if hasattr(o, 'notas'):
                data['notas'] = o.notas
            
            # Campos opcionales
            if hasattr(o, 'propiedad_id'):
                data['propiedad_id'] = o.propiedad_id
            if hasattr(o, 'emprendimiento_id'):
                data['emprendimiento_id'] = o.emprendimiento_id
            if hasattr(o, 'monto_estimado') and o.monto_estimado:
                data['monto_estimado'] = float(o.monto_estimado)
            if hasattr(o, 'moneda_id'):
                data['moneda_id'] = o.moneda_id
            if hasattr(o, 'probabilidad'):
                data['probabilidad'] = o.probabilidad
            if hasattr(o, 'fecha_estimada_cierre'):
                data['fecha_estimada_cierre'] = o.fecha_estimada_cierre
            if hasattr(o, 'fecha_cierre_real'):
                data['fecha_cierre_real'] = o.fecha_cierre_real
            if hasattr(o, 'condicion_pago_id'):
                data['condicion_pago_id'] = o.condicion_pago_id
            if hasattr(o, 'monto_cierre') and o.monto_cierre:
                data['monto_cierre'] = float(o.monto_cierre)
            if hasattr(o, 'motivo_perdida_id'):
                data['motivo_perdida_id'] = o.motivo_perdida_id
            if hasattr(o, 'notas_perdida'):
                data['notas_perdida'] = o.notas_perdida
            if hasattr(o, 'created_at') and o.created_at:
                data['created_at'] = o.created_at
            if hasattr(o, 'updated_at') and o.updated_at:
                data['updated_at'] = o.updated_at
                
            opor_data.append(data)
        
        print(f"✅ {len(opor_data)} oportunidades exportadas")
        return opor_data

def export_eventos():
    """Exportar eventos de base local"""
    print("\n" + "="*70)
    print("EXPORTANDO EVENTOS")
    print("="*70)
    
    with Session(local_engine) as session:
        eventos = session.exec(select(CRMEvento)).all()
        
        eventos_data = []
        for e in eventos:
            data = {
                'contacto_id': e.contacto_id,
                'tipo_id': e.tipo_id,
                'motivo_id': e.motivo_id,
                'fecha_evento': e.fecha_evento,
                'descripcion': e.descripcion,
                'asignado_a_id': e.asignado_a_id,
                'estado_evento': e.estado_evento,
                '_original_id': e.id
            }
            
            # Campos opcionales
            if hasattr(e, 'oportunidad_id'):
                data['oportunidad_id'] = e.oportunidad_id
            if hasattr(e, 'origen_lead_id'):
                data['origen_lead_id'] = e.origen_lead_id
            if hasattr(e, 'proximo_paso'):
                data['proximo_paso'] = e.proximo_paso
            if hasattr(e, 'fecha_compromiso'):
                data['fecha_compromiso'] = e.fecha_compromiso
            if hasattr(e, 'created_at') and e.created_at:
                data['created_at'] = e.created_at
            if hasattr(e, 'updated_at') and e.updated_at:
                data['updated_at'] = e.updated_at
                
            eventos_data.append(data)
        
        print(f"✅ {len(eventos_data)} eventos exportados")
        return eventos_data

def export_logs_estado():
    """Exportar logs de estado de oportunidades"""
    print("\n" + "="*70)
    print("EXPORTANDO LOGS DE ESTADO")
    print("="*70)
    
    with Session(local_engine) as session:
        logs = session.exec(select(CRMOportunidadLogEstado)).all()
        
        logs_data = []
        for log in logs:
            data = {
                'oportunidad_id': log.oportunidad_id,
                'estado_anterior': log.estado_anterior,
                'estado_nuevo': log.estado_nuevo,
                'usuario_id': log.usuario_id,
                'fecha_registro': log.fecha_registro,
                '_original_oportunidad_id': log.oportunidad_id
            }
            
            # Campos opcionales
            if hasattr(log, 'descripcion'):
                data['descripcion'] = log.descripcion
            if hasattr(log, 'monto') and log.monto:
                data['monto'] = float(log.monto)
            if hasattr(log, 'moneda_id'):
                data['moneda_id'] = log.moneda_id
            if hasattr(log, 'condicion_pago_id'):
                data['condicion_pago_id'] = log.condicion_pago_id
            if hasattr(log, 'motivo_perdida_id'):
                data['motivo_perdida_id'] = log.motivo_perdida_id
                
            logs_data.append(data)
        
        print(f"✅ {len(logs_data)} logs de estado exportados")
        return logs_data

def get_id_mappings(prod_engine):
    """Obtener mapeos de IDs entre local y producción"""
    print("\n" + "="*70)
    print("OBTENIENDO MAPEOS DE IDs")
    print("="*70)
    
    mappings = {
        'propiedades': {},
        'users': {},
        'contactos': {},
        'oportunidades': {}
    }
    
    # Mapeo simple: asumimos que los IDs de catálogos son iguales
    # Solo necesitamos mapear propiedades y usuarios si hay diferencias
    
    print("✅ Mapeos preparados (se usarán IDs originales para catálogos)")
    return mappings

def import_contactos(contactos_data, prod_engine):
    """Importar contactos a producción"""
    print("\n" + "="*70)
    print("IMPORTANDO CONTACTOS A PRODUCCIÓN")
    print("="*70)
    
    contacto_id_map = {}
    insertados = 0
    actualizados = 0
    
    with Session(prod_engine) as session:
        for data in contactos_data:
            original_id = data.pop('_original_id')
            
            # Verificar si ya existe por email
            existing = None
            if data.get('email'):
                existing = session.exec(
                    select(CRMContacto).where(CRMContacto.email == data['email'])
                ).first()
            
            if existing:
                # Actualizar
                for key, value in data.items():
                    setattr(existing, key, value)
                contacto_id_map[original_id] = existing.id
                actualizados += 1
            else:
                # Insertar nuevo
                contacto = CRMContacto(**data)
                session.add(contacto)
                session.flush()
                contacto_id_map[original_id] = contacto.id
                insertados += 1
        
        session.commit()
    
    print(f"✅ Contactos: {insertados} insertados, {actualizados} actualizados")
    return contacto_id_map

def import_oportunidades(opor_data, contacto_id_map, prod_engine):
    """Importar oportunidades a producción"""
    print("\n" + "="*70)
    print("IMPORTANDO OPORTUNIDADES A PRODUCCIÓN")
    print("="*70)
    
    oportunidad_id_map = {}
    insertados = 0
    
    with Session(prod_engine) as session:
        for data in opor_data:
            original_id = data.pop('_original_id')
            
            # Mapear contacto_id
            if data['contacto_id'] and data['contacto_id'] in contacto_id_map:
                data['contacto_id'] = contacto_id_map[data['contacto_id']]
            
            # Verificar que la propiedad existe en prod
            if data['propiedad_id']:
                prop_exists = session.exec(
                    select(Propiedad).where(Propiedad.id == data['propiedad_id'])
                ).first()
                if not prop_exists:
                    print(f"  ⚠️  Propiedad {data['propiedad_id']} no existe, saltando oportunidad")
                    continue
            
            oportunidad = CRMOportunidad(**data)
            session.add(oportunidad)
            session.flush()
            oportunidad_id_map[original_id] = oportunidad.id
            insertados += 1
        
        session.commit()
    
    print(f"✅ Oportunidades: {insertados} insertadas")
    return oportunidad_id_map

def import_eventos(eventos_data, contacto_id_map, oportunidad_id_map, prod_engine):
    """Importar eventos a producción"""
    print("\n" + "="*70)
    print("IMPORTANDO EVENTOS A PRODUCCIÓN")
    print("="*70)
    
    insertados = 0
    saltados = 0
    
    with Session(prod_engine) as session:
        for data in eventos_data:
            data.pop('_original_id', None)
            
            # Mapear contacto_id
            if data['contacto_id'] and data['contacto_id'] in contacto_id_map:
                data['contacto_id'] = contacto_id_map[data['contacto_id']]
            
            # Mapear oportunidad_id
            if data.get('oportunidad_id'):
                if data['oportunidad_id'] in oportunidad_id_map:
                    data['oportunidad_id'] = oportunidad_id_map[data['oportunidad_id']]
                else:
                    # Saltar este evento si la oportunidad no existe
                    saltados += 1
                    continue
            
            evento = CRMEvento(**data)
            session.add(evento)
            insertados += 1
        
        session.commit()
    
    print(f"✅ Eventos: {insertados} insertados, {saltados} saltados (oportunidad no existe)")

def import_logs_estado(logs_data, oportunidad_id_map, prod_engine):
    """Importar logs de estado a producción"""
    print("\n" + "="*70)
    print("IMPORTANDO LOGS DE ESTADO A PRODUCCIÓN")
    print("="*70)
    
    insertados = 0
    
    with Session(prod_engine) as session:
        for data in logs_data:
            original_opor_id = data.pop('_original_oportunidad_id')
            
            # Mapear oportunidad_id
            if original_opor_id in oportunidad_id_map:
                data['oportunidad_id'] = oportunidad_id_map[original_opor_id]
                
                log = CRMOportunidadLogEstado(**data)
                session.add(log)
                insertados += 1
        
        session.commit()
    
    print(f"✅ Logs de estado: {insertados} insertados")

def main():
    print("="*70)
    print("COPIAR DATOS CRM DE LOCAL A PRODUCCIÓN")
    print("="*70)
    print("\n⚠️  Este script copiará:")
    print("  - Contactos")
    print("  - Oportunidades")
    print("  - Eventos")
    print("  - Logs de estado de oportunidades")
    print("\nSe mantendrá la consistencia con las propiedades existentes.")
    
    # 1. Exportar datos de local
    contactos_data = export_contactos()
    opor_data = export_oportunidades()
    eventos_data = export_eventos()
    logs_data = export_logs_estado()
    
    # Resumen
    print("\n" + "="*70)
    print("RESUMEN DE DATOS A COPIAR")
    print("="*70)
    print(f"  Contactos: {len(contactos_data)}")
    print(f"  Oportunidades: {len(opor_data)}")
    print(f"  Eventos: {len(eventos_data)}")
    print(f"  Logs de estado: {len(logs_data)}")
    
    # Confirmar
    print("\n⚠️  Se copiarán estos datos a PRODUCCIÓN (Neon)")
    respuesta = input("¿Continuar? (s/n): ")
    
    if respuesta.lower() != 's':
        print("❌ Operación cancelada")
        return
    
    # 2. Obtener DATABASE_URL de producción
    prod_db_url = get_production_database_url()
    if not prod_db_url:
        print("❌ No se pudo obtener la URL de producción")
        return
    
    prod_engine = create_engine(prod_db_url)
    
    # 3. Importar a producción
    try:
        mappings = get_id_mappings(prod_engine)
        
        contacto_id_map = import_contactos(contactos_data, prod_engine)
        oportunidad_id_map = import_oportunidades(opor_data, contacto_id_map, prod_engine)
        import_eventos(eventos_data, contacto_id_map, oportunidad_id_map, prod_engine)
        import_logs_estado(logs_data, oportunidad_id_map, prod_engine)
        
        print("\n" + "="*70)
        print("✅ PROCESO COMPLETADO EXITOSAMENTE")
        print("="*70)
        print(f"\n  Contactos: {len(contacto_id_map)} procesados")
        print(f"  Oportunidades: {len(oportunidad_id_map)} procesadas")
        print(f"  Eventos y logs importados")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
