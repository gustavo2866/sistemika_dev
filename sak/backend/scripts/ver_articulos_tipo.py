"""
Script para ver qué artículos están en cada tipo
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def ver_articulos_por_tipo():
    """Ver artículos de tipos específicos"""
    # Cargar variables de entorno
    load_dotenv()
    
    # Crear engine
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ ERROR: DATABASE_URL no está configurado")
        return
        
    engine = create_engine(db_url)
    
    with Session(engine) as session:
        # Ver artículos del tipo "Servicio"
        print("🔍 Artículos del tipo 'Servicio' (ID: 13):")
        result = session.execute(text("""
            SELECT a.id, a.nombre, a.precio, a.marca, a.sku
            FROM articulos a
            WHERE a.tipo_articulo_id = 13
            ORDER BY a.nombre
            LIMIT 10
        """))
        
        for i, row in enumerate(result, 1):
            print(f"  {i}. {row.nombre} - Precio: ${row.precio} - Marca: {row.marca}")
            
        # Ver también algunos del tipo "Material" para comparar
        print("\n🔍 Artículos del tipo 'Material' (ID: 1) - primeros 5:")
        result = session.execute(text("""
            SELECT a.id, a.nombre, a.precio, a.marca
            FROM articulos a
            WHERE a.tipo_articulo_id = 1
            ORDER BY a.nombre
            LIMIT 5
        """))
        
        for i, row in enumerate(result, 1):
            print(f"  {i}. {row.nombre} - Precio: ${row.precio} - Marca: {row.marca}")

if __name__ == "__main__":
    ver_articulos_por_tipo()