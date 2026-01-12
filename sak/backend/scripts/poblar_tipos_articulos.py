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
from app.models.adm import AdmConcepto

# Tipos de artículos basados en DEFAULT_ARTICULOS del modelo Articulo

DEFAULT_CONCEPTO_NOMBRE = "Concepto default"
DEFAULT_CONCEPTO_CUENTA = "DEFAULT"

def get_default_concepto_id(session: Session) -> int:
    concepto = session.exec(
        select(AdmConcepto).where(AdmConcepto.cuenta == DEFAULT_CONCEPTO_CUENTA)
    ).first()
    if concepto:
        return concepto.id
    concepto = AdmConcepto(
        nombre=DEFAULT_CONCEPTO_NOMBRE,
        descripcion="Concepto por defecto para tipos de articulo",
        cuenta=DEFAULT_CONCEPTO_CUENTA,
    )
    session.add(concepto)
    session.commit()
    session.refresh(concepto)
    return concepto.id

TIPOS_ARTICULOS_INICIALES = [
    {
        'nombre': 'Material',
        'descripcion': 'Materiales de construcción básicos como cemento, arena, grava, ladrillos',
        'activo': True
    },
    {
        'nombre': 'Ferreteria',
        'descripcion': 'Artículos de ferretería como clavos, tornillos, herramientas menores',
        'activo': True
    },
    {
        'nombre': 'Pintura',
        'descripcion': 'Pinturas, esmaltes, lacas y productos de terminación',
        'activo': True
    },
    {
        'nombre': 'Herramienta',
        'descripcion': 'Herramientas de trabajo, utensilios y equipos',
        'activo': True
    },
    {
        'nombre': 'Sellador',
        'descripcion': 'Selladores, siliconas y productos de sellado',
        'activo': True
    },
    {
        'nombre': 'Impermeabilizante',
        'descripcion': 'Membranas y productos de impermeabilización',
        'activo': True
    },
    {
        'nombre': 'Cubierta',
        'descripcion': 'Materiales para cubiertas y techos como tejas',
        'activo': True
    },
    {
        'nombre': 'Aislante',
        'descripcion': 'Materiales aislantes térmicos y acústicos',
        'activo': True
    },
    {
        'nombre': 'Terminacion',
        'descripcion': 'Materiales de terminación y acabados',
        'activo': True
    },
    {
        'nombre': 'Perfileria',
        'descripcion': 'Perfiles metálicos y estructurales',
        'activo': True
    },
    {
        'nombre': 'Sanitario',
        'descripcion': 'Artículos sanitarios como inodoros, lavatorios, bidets',
        'activo': True
    },
    {
        'nombre': 'Griferia',
        'descripcion': 'Grifería para cocina, baño y uso general',
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
        default_concepto_id = get_default_concepto_id(session)
        
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
            nuevo_tipo = TipoArticulo(**tipo_data, adm_concepto_id=default_concepto_id)
            session.add(nuevo_tipo)
            print(f"  + Creando tipo: {tipo_data['nombre']}")
        
        # Guardar cambios
        session.commit()
        print("✅ Poblado completado!")

if __name__ == "__main__":
    poblar_tipos_articulos()
