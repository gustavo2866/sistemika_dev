from app.db import engine
from app.models.compras import PoOrdenCompra, PoOrdenCompraDetalle
from sqlmodel import select, Session
from decimal import Decimal
import traceback

def test_manual_creation():
    """Prueba crear manualmente un detalle para la orden ID=2"""
    try:
        with Session(engine) as session:
            # Verificar que la orden existe
            orden = session.exec(select(PoOrdenCompra).where(PoOrdenCompra.id == 2)).first()
            if not orden:
                print("ERROR: Orden ID=2 no existe")
                return
                
            print(f"Orden encontrada: ID={orden.id}, Numero={orden.numero}")
            
            # Crear un detalle manualmente
            detalle = PoOrdenCompraDetalle(
                orden_compra_id=2,
                descripcion="Test Articulo Manual",
                cantidad=Decimal("1"),
                precio_unitario=Decimal("100.00"),
                subtotal=Decimal("100.00"),
                porcentaje_iva=Decimal("21.00"),
                importe_iva=Decimal("21.00"),
                total_linea=Decimal("121.00"),
                orden=1,
                unidad_medida="unidad"
            )
            
            session.add(detalle)
            session.commit()
            
            print(f"Detalle creado exitosamente con ID: {detalle.id}")
            
            # Verificar que se guardó
            verificacion = session.exec(
                select(PoOrdenCompraDetalle).where(PoOrdenCompraDetalle.orden_compra_id == 2)
            ).all()
            print(f"Detalles encontrados después de crear: {len(verificacion)}")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        print("Traceback:")
        traceback.print_exc()

if __name__ == "__main__":
    test_manual_creation()