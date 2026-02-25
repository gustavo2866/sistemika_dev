"""
Script para poblar la entidad TipoActualizacion con los tipos estándar
"""

import sys
from pathlib import Path

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent))

from sqlmodel import Session, create_engine, select
from dotenv import load_dotenv
import os

from app.models.tipo_actualizacion import TipoActualizacion

# Cargar variables de entorno
load_dotenv()

# Configurar conexión a la base de datos
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL no está configurada")

engine = create_engine(DATABASE_URL)

# Datos de tipos de actualización estándar
TIPOS_ACTUALIZACION_DATA = [
    {
        "nombre": "Trimestral",
        "cantidad_meses": 3,
        "activa": True
    },
    {
        "nombre": "Cuatrimestral", 
        "cantidad_meses": 4,
        "activa": True
    },
    {
        "nombre": "Semestral",
        "cantidad_meses": 6,
        "activa": True
    },
    {
        "nombre": "Anual",
        "cantidad_meses": 12,
        "activa": True
    }
]


def main():
    """Función principal para poblar tipos de actualización"""
    print("📅 Iniciando población de tipos de actualización...")
    print(f"📊 Tipos a crear: {len(TIPOS_ACTUALIZACION_DATA)}")
    
    tipos_creados = 0
    tipos_duplicados = 0
    
    try:
        with Session(engine) as session:
            for tipo_data in TIPOS_ACTUALIZACION_DATA:
                # Verificar si ya existe un tipo con el mismo nombre
                existing = session.exec(
                    select(TipoActualizacion).where(
                        TipoActualizacion.nombre == tipo_data["nombre"]
                    )
                ).first()
                
                if existing:
                    print(f"⚠️  Tipo '{tipo_data['nombre']}' ya existe")
                    tipos_duplicados += 1
                    continue
                
                # Crear nuevo tipo de actualización
                tipo = TipoActualizacion(**tipo_data)
                session.add(tipo)
                tipos_creados += 1
                print(f"✅ Creado: {tipo_data['nombre']} ({tipo_data['cantidad_meses']} meses)")
            
            # Confirmar cambios
            session.commit()
            print(f"\n🎉 Proceso completado:")
            print(f"   - Tipos creados: {tipos_creados}")
            print(f"   - Tipos duplicados (omitidos): {tipos_duplicados}")
            
            # Mostrar todos los tipos creados
            todos_los_tipos = session.exec(select(TipoActualizacion).order_by(TipoActualizacion.cantidad_meses)).all()
            print(f"   - Total en base de datos: {len(todos_los_tipos)}")
            print(f"\n📋 Tipos de actualización disponibles:")
            for tipo in todos_los_tipos:
                estado = "✅ Activa" if tipo.activa else "🔴 Inactiva"
                print(f"   - {tipo.nombre}: {tipo.cantidad_meses} meses ({estado})")
            
    except Exception as e:
        print(f"❌ Error durante la población: {e}")
        raise


if __name__ == "__main__":
    main()