from app.db import get_session
from app.models.compras import PoSolicitudDetalle
import decimal

def test_insert():
    """Prueba insertar un nuevo detalle para verificar que no hay errores"""
    session = next(get_session())
    
    try:
        # Crear un nuevo detalle de prueba
        nuevo_detalle = PoSolicitudDetalle(
            solicitud_id=94,  # Usar el mismo solicitud_id del error original
            articulo_id=5,
            descripcion="Test de reparación",
            unidad_medida="UN",
            cantidad=decimal.Decimal("1"),
            precio=decimal.Decimal("100"),
            importe=decimal.Decimal("100")
        )
        
        session.add(nuevo_detalle)
        session.commit()
        
        print("✅ Inserción exitosa!")
        print(f"   Nuevo registro ID: {nuevo_detalle.id}")
        print(f"   Solicitud ID: {nuevo_detalle.solicitud_id}")
        
        # Limpiar - eliminar el registro de prueba
        session.delete(nuevo_detalle)
        session.commit()
        print("✅ Registro de prueba eliminado")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error en la prueba: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    test_insert()