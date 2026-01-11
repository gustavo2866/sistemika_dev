"""
Script para verificar la configuración de tipos de solicitud y sus filtros
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from app.models import TipoSolicitud, TipoArticulo

def verificar_filtros_tipos():
    """Verifica los filtros configurados en tipos de solicitud"""
    # Cargar variables de entorno
    load_dotenv()
    
    # Crear engine
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ ERROR: DATABASE_URL no está configurado")
        return
        
    engine = create_engine(db_url)
    
    with Session(engine) as session:
        print("🔍 Verificando configuración de tipos de solicitud...")
        
        # Obtener todos los tipos de solicitud
        tipos_solicitud = session.exec(select(TipoSolicitud)).all()
        
        print(f"\n📋 Encontrados {len(tipos_solicitud)} tipos de solicitud:")
        for tipo in tipos_solicitud:
            print(f"  ID: {tipo.id}")
            print(f"  Nombre: {tipo.nombre}")
            print(f"  Filtro artículo: '{tipo.tipo_articulo_filter}'")
            print(f"  Artículo default: {tipo.articulo_default_id}")
            print(f"  Departamento default: {tipo.departamento_default_id}")
            print(f"  Activo: {tipo.activo}")
            print("  ---")
        
        print("\n🔍 Verificando tipos de artículos disponibles...")
        tipos_articulo = session.exec(select(TipoArticulo)).all()
        
        print(f"\n📋 Encontrados {len(tipos_articulo)} tipos de artículo:")
        for tipo in tipos_articulo:
            print(f"  ID: {tipo.id} - Nombre: '{tipo.nombre}' - Código: '{tipo.codigo_contable}'")
        
        # Verificar qué artículos están asociados a cada tipo
        print("\n🔍 Verificando artículos por tipo...")
        result = session.execute(text("""
            SELECT ta.id, ta.nombre as tipo_nombre, COUNT(a.id) as cantidad_articulos
            FROM tipos_articulo ta
            LEFT JOIN articulos a ON ta.id = a.tipo_articulo_id 
            GROUP BY ta.id, ta.nombre
            ORDER BY ta.id
        """))
        
        for row in result:
            print(f"  Tipo '{row.tipo_nombre}' (ID: {row.id}): {row.cantidad_articulos} artículos")

if __name__ == "__main__":
    verificar_filtros_tipos()