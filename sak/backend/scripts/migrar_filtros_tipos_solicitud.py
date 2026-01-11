"""
Script para migrar datos de tipo_articulo_filter (string) a tipo_articulo_filter_id (foreign key)
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from app.models import TipoSolicitud, TipoArticulo

def migrar_filtros_tipos_solicitud():
    """Migra los filtros de string a foreign key"""
    # Cargar variables de entorno
    load_dotenv()
    
    # Crear engine
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ ERROR: DATABASE_URL no está configurado")
        return
        
    engine = create_engine(db_url)
    
    with Session(engine) as session:
        print("🔄 Migrando filtros de tipos de solicitud...")
        
        # Obtener mapeo de tipos de artículos
        tipos_articulo = session.exec(select(TipoArticulo)).all()
        tipo_map = {tipo.nombre: tipo.id for tipo in tipos_articulo}
        print(f"📋 Tipos de artículo disponibles: {list(tipo_map.keys())}")
        
        # Obtener tipos de solicitud con filtro string
        tipos_solicitud = session.exec(
            select(TipoSolicitud).where(
                TipoSolicitud.tipo_articulo_filter.is_not(None),
                TipoSolicitud.tipo_articulo_filter_id.is_(None)
            )
        ).all()
        
        print(f"📊 Tipos de solicitud a migrar: {len(tipos_solicitud)}")
        
        migrados = 0
        for tipo_solicitud in tipos_solicitud:
            filtro_nombre = tipo_solicitud.tipo_articulo_filter
            tipo_articulo_id = tipo_map.get(filtro_nombre)
            
            if tipo_articulo_id:
                tipo_solicitud.tipo_articulo_filter_id = tipo_articulo_id
                session.add(tipo_solicitud)
                print(f"  ✅ {tipo_solicitud.nombre}: '{filtro_nombre}' → ID {tipo_articulo_id}")
                migrados += 1
            else:
                print(f"  ⚠️ {tipo_solicitud.nombre}: '{filtro_nombre}' NO ENCONTRADO")
        
        session.commit()
        print(f"\n✅ Migración completada: {migrados} tipos de solicitud actualizados")
        
        # Verificar estado final
        print("\n📊 Estado final de tipos de solicitud:")
        todos_tipos = session.exec(select(TipoSolicitud)).all()
        for tipo in todos_tipos:
            if tipo.tipo_articulo_filter_id:
                tipo_articulo = session.get(TipoArticulo, tipo.tipo_articulo_filter_id)
                print(f"  {tipo.nombre}: Filtro ID {tipo.tipo_articulo_filter_id} ({tipo_articulo.nombre if tipo_articulo else 'NO ENCONTRADO'})")
            elif tipo.tipo_articulo_filter:
                print(f"  {tipo.nombre}: Filtro string '{tipo.tipo_articulo_filter}' (NO MIGRADO)")
            else:
                print(f"  {tipo.nombre}: Sin filtro")

if __name__ == "__main__":
    migrar_filtros_tipos_solicitud()