from app.database import engine
from sqlmodel import Session, select
from app.models.factura import Factura
from app.models.user import User
from app.models.proveedor import Proveedor
from app.models.tipo_operacion import TipoOperacion

def check_integrity():
    with Session(engine) as session:
        # Verificar facturas
        facturas = session.exec(select(Factura)).all()
        print(f'Total facturas: {len(facturas)}')
        
        errors = []
        
        for factura in facturas:
            print(f'\nFactura {factura.id}:')
            print(f'  usuario_responsable_id = {factura.usuario_responsable_id}')
            print(f'  proveedor_id = {factura.proveedor_id}')
            print(f'  tipo_operacion_id = {factura.tipo_operacion_id}')
            
            # Verificar usuario responsable
            if factura.usuario_responsable_id:
                user = session.get(User, factura.usuario_responsable_id)
                if not user:
                    errors.append(f'Factura {factura.id} referencia usuario {factura.usuario_responsable_id} que no existe')
                else:
                    print(f'  ✓ Usuario: {user.nombre}')
            else:
                errors.append(f'Factura {factura.id} tiene usuario_responsable_id NULL')
            
            # Verificar proveedor
            proveedor = session.get(Proveedor, factura.proveedor_id)
            if not proveedor:
                errors.append(f'Factura {factura.id} referencia proveedor {factura.proveedor_id} que no existe')
            else:
                print(f'  ✓ Proveedor: {proveedor.nombre}')
            
            # Verificar tipo operación
            tipo_op = session.get(TipoOperacion, factura.tipo_operacion_id)
            if not tipo_op:
                errors.append(f'Factura {factura.id} referencia tipo_operacion {factura.tipo_operacion_id} que no existe')
            else:
                print(f'  ✓ Tipo Operación: {tipo_op.descripcion}')
        
        print(f'\n=== RESUMEN ===')
        if errors:
            print('ERRORES ENCONTRADOS:')
            for error in errors:
                print(f'  - {error}')
        else:
            print('✓ Todos los datos están íntegros')
        
        return len(errors) == 0

if __name__ == "__main__":
    check_integrity()
