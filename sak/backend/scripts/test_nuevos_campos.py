"""
Test simple para verificar el nuevo campo tipo_articulo_filter_id en tipos_solicitud
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from dotenv import load_dotenv
from sqlalchemy import create_engine
from app.models import TipoSolicitud, TipoArticulo

def test_nuevos_campos():
    """Prueba que los nuevos campos estén funcionando"""
    # Cargar variables de entorno
    load_dotenv()
    
    # Crear engine
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ ERROR: DATABASE_URL no está configurado")
        return
        
    engine = create_engine(db_url)
    
    with Session(engine) as session:
        print("🔍 Verificando nuevos campos en tipos_solicitud...")
        
        # Obtener todos los tipos de solicitud con sus relaciones
        tipos_solicitud = session.exec(
            select(TipoSolicitud, TipoArticulo)
            .join(TipoArticulo, TipoSolicitud.tipo_articulo_filter_id == TipoArticulo.id, isouter=True)
        ).all()
        
        print(f"\n📊 Encontrados {len(tipos_solicitud)} tipos de solicitud:")
        print("=" * 80)
        
        for tipo_solicitud, tipo_articulo in tipos_solicitud:
            print(f"🏷️ {tipo_solicitud.nombre}")
            print(f"   └── Filtro ID: {tipo_solicitud.tipo_articulo_filter_id}")
            print(f"   └── Filtro string: {tipo_solicitud.tipo_articulo_filter}")
            if tipo_articulo:
                print(f"   └── Tipo artículo: {tipo_articulo.nombre} (ID: {tipo_articulo.id})")
            else:
                print(f"   └── Tipo artículo: No configurado")
            print()
            
        print("✅ Verificación completada")

if __name__ == "__main__":
    test_nuevos_campos()