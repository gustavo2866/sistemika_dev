"""
Script para cambiar el tipo de operación de propiedades
de Emprendimiento (id=3) a Venta (id=2)
"""
from app.db import get_session
from app.models.propiedad import Propiedad
from sqlmodel import select

def main():
    session = next(get_session())
    
    try:
        # Consultar propiedades con tipo_operacion_id = 3 (Emprendimiento)
        statement = select(Propiedad).where(Propiedad.tipo_operacion_id == 3)
        propiedades = session.exec(statement).all()
        
        print(f"\n✓ Encontradas {len(propiedades)} propiedades con tipo_operacion_id = 3 (Emprendimiento)")
        
        if not propiedades:
            print("No hay propiedades para actualizar.")
            return
        
        # Mostrar las propiedades a actualizar
        print("\nPropiedades a actualizar:")
        for p in propiedades:
            print(f"  - ID: {p.id}, Nombre: {p.nombre}")
        
        # Actualizar el tipo de operación a Venta (id=2)
        for p in propiedades:
            p.tipo_operacion_id = 2
            session.add(p)
        
        session.commit()
        print(f"\n✓ Se actualizaron {len(propiedades)} propiedades de 'Emprendimiento' a 'Venta' exitosamente.")
        
        # Verificar el cambio
        statement_check = select(Propiedad).where(Propiedad.tipo_operacion_id == 2)
        propiedades_venta = session.exec(statement_check).all()
        print(f"\n✓ Total de propiedades con tipo 'Venta' ahora: {len(propiedades_venta)}")
        
    except Exception as e:
        session.rollback()
        print(f"\n✗ Error al actualizar propiedades: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    main()
