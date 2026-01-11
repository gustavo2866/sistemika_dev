"""
Script para migrar datos existentes de tipo_articulo (string) a tipo_articulo_id (foreign key)
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from app.models import TipoArticulo

def migrar_datos_articulos():
    """Migra los datos existentes de tipo_articulo string a foreign key"""
    # Cargar variables de entorno
    load_dotenv()
    
    # Crear engine
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ ERROR: DATABASE_URL no está configurado")
        return
        
    engine = create_engine(db_url)
    
    with Session(engine) as session:
        print("🔄 Migrando datos de artículos...")
        
        # Obtener mapeo de tipos
        tipos = session.exec(select(TipoArticulo)).all()
        tipo_map = {tipo.nombre: tipo.id for tipo in tipos}
        print(f"📋 Tipos disponibles: {list(tipo_map.keys())}")
        
        # Obtener artículos con tipo_articulo (string)
        result = session.execute(text("""
            SELECT id, tipo_articulo 
            FROM articulos 
            WHERE tipo_articulo IS NOT NULL 
            AND tipo_articulo_id IS NULL
        """))
        
        articulos = result.fetchall()
        print(f"📊 Artículos a migrar: {len(articulos)}")
        
        if not articulos:
            print("✅ No hay artículos para migrar")
            return
        
        migrados = 0
        no_encontrados = set()
        
        for articulo in articulos:
            tipo_nombre = articulo.tipo_articulo
            tipo_id = tipo_map.get(tipo_nombre)
            
            if tipo_id:
                # Actualizar tipo_articulo_id
                session.execute(text("""
                    UPDATE articulos 
                    SET tipo_articulo_id = :tipo_id 
                    WHERE id = :articulo_id
                """), {"tipo_id": tipo_id, "articulo_id": articulo.id})
                migrados += 1
            else:
                no_encontrados.add(tipo_nombre)
        
        if no_encontrados:
            print(f"⚠️  Tipos no encontrados: {list(no_encontrados)}")
            print("Creando tipos faltantes...")
            
            # Crear tipos faltantes
            for nombre_tipo in no_encontrados:
                nuevo_tipo = TipoArticulo(
                    nombre=nombre_tipo,
                    descripcion=f"Tipo {nombre_tipo} migrado automáticamente",
                    codigo_contable=f"{nombre_tipo[:3].upper()}-MIG",
                    activo=True
                )
                session.add(nuevo_tipo)
                session.flush()  # Para obtener el ID
                
                # Actualizar artículos con este nuevo tipo
                session.execute(text("""
                    UPDATE articulos 
                    SET tipo_articulo_id = :tipo_id 
                    WHERE tipo_articulo = :tipo_nombre
                    AND tipo_articulo_id IS NULL
                """), {"tipo_id": nuevo_tipo.id, "tipo_nombre": nombre_tipo})
                
                print(f"  + Creado tipo: {nombre_tipo} (ID: {nuevo_tipo.id})")
        
        session.commit()
        print(f"✅ Migración completada: {migrados} artículos actualizados")
        
        # Verificar migración
        result = session.execute(text("""
            SELECT COUNT(*) as total,
                   COUNT(tipo_articulo_id) as con_fk,
                   COUNT(tipo_articulo) as con_string
            FROM articulos
        """))
        stats = result.fetchone()
        print(f"📊 Estado final: {stats.total} total, {stats.con_fk} con FK, {stats.con_string} con string")

if __name__ == "__main__":
    migrar_datos_articulos()