"""
Script para poblar la tabla tipos_articulo con datos iniciales
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from dotenv import load_dotenv
from sqlalchemy import create_engine
from app.models import TipoArticulo

# Tipos de artículos basados en DEFAULT_ARTICULOS del modelo Articulo
TIPOS_ARTICULOS_INICIALES = [
    {
        'nombre': 'Material',
        'descripcion': 'Materiales de construcción básicos como cemento, arena, grava, ladrillos',
        'codigo_contable': 'MAT-001',
        'activo': True
    },
    {
        'nombre': 'Ferreteria',
        'descripcion': 'Artículos de ferretería como clavos, tornillos, herramientas menores',
        'codigo_contable': 'FER-001',
        'activo': True
    },
    {
        'nombre': 'Pintura',
        'descripcion': 'Pinturas, esmaltes, lacas y productos de terminación',
        'codigo_contable': 'PIN-001',
        'activo': True
    },
    {
        'nombre': 'Herramienta',
        'descripcion': 'Herramientas de trabajo, utensilios y equipos',
        'codigo_contable': 'HER-001',
        'activo': True
    },
    {
        'nombre': 'Sellador',
        'descripcion': 'Selladores, siliconas y productos de sellado',
        'codigo_contable': 'SEL-001',
        'activo': True
    },
    {
        'nombre': 'Impermeabilizante',
        'descripcion': 'Membranas y productos de impermeabilización',
        'codigo_contable': 'IMP-001',
        'activo': True
    },
    {
        'nombre': 'Cubierta',
        'descripcion': 'Materiales para cubiertas y techos como tejas',
        'codigo_contable': 'CUB-001',
        'activo': True
    },
    {
        'nombre': 'Aislante',
        'descripcion': 'Materiales aislantes térmicos y acústicos',
        'codigo_contable': 'AIS-001',
        'activo': True
    },
    {
        'nombre': 'Terminacion',
        'descripcion': 'Materiales de terminación y acabados',
        'codigo_contable': 'TER-001',
        'activo': True
    },
    {
        'nombre': 'Perfileria',
        'descripcion': 'Perfiles metálicos y estructurales',
        'codigo_contable': 'PER-001',
        'activo': True
    },
    {
        'nombre': 'Sanitario',
        'descripcion': 'Artículos sanitarios como inodoros, lavatorios, bidets',
        'codigo_contable': 'SAN-001',
        'activo': True
    },
    {
        'nombre': 'Griferia',
        'descripcion': 'Grifería para cocina, baño y uso general',
        'codigo_contable': 'GRI-001',
        'activo': True
    }
]

def poblar_tipos_articulos():
    """Pobla la tabla tipos_articulo con datos iniciales"""
    # Cargar variables de entorno
    load_dotenv()
    
    # Crear engine
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ ERROR: DATABASE_URL no está configurado")
        return
        
    engine = create_engine(db_url)
    
    with Session(engine) as session:
        print("Poblando tabla tipos_articulo...")
        
        # Verificar si ya existen tipos
        tipos_existentes = session.exec(select(TipoArticulo)).all()
        if tipos_existentes:
            print(f"Ya existen {len(tipos_existentes)} tipos de artículos en la base de datos.")
            print("¿Desea continuar y agregar los faltantes? (los existentes se omitirán)")
        
        for tipo_data in TIPOS_ARTICULOS_INICIALES:
            # Verificar si ya existe
            tipo_existente = session.exec(
                select(TipoArticulo).where(TipoArticulo.nombre == tipo_data['nombre'])
            ).first()
            
            if tipo_existente:
                print(f"  - Tipo '{tipo_data['nombre']}' ya existe, omitiendo...")
                continue
            
            # Crear nuevo tipo
            nuevo_tipo = TipoArticulo(**tipo_data)
            session.add(nuevo_tipo)
            print(f"  + Creando tipo: {tipo_data['nombre']}")
        
        # Guardar cambios
        session.commit()
        print("✅ Poblado completado!")

if __name__ == "__main__":
    poblar_tipos_articulos()