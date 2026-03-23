"""
Popula po_order_status_log con entradas históricas consistentes.

Reglas:
- Las órdenes en estado "borrador" (id=1) se omiten.
- Para el resto se reconstruye la cadena de estados desde "solicitada".
- Las fechas se distribuyen a partir de created_at de la orden.
- Espaciado entre transiciones: +1 día por paso.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import timedelta
from app.db import engine
from app.models.compras import PoOrder, PoOrderStatusLog
from sqlmodel import Session, select

# IDs de estado (según la DB)
STATUS_BORRADOR   = 1
STATUS_SOLICITADA = 2
STATUS_EMITIDA    = 3
STATUS_APROBADA   = 4
STATUS_RECHAZADA  = 5
STATUS_FACTURADA  = 7

# Cadena de transiciones hasta cada estado final
# Cada tupla es (status_anterior_id, status_nuevo_id)
# None como anterior = primera transición (creación de la solicitud)
CHAINS: dict[int, list[tuple[int | None, int]]] = {
    STATUS_SOLICITADA: [
        (None, STATUS_SOLICITADA),
    ],
    STATUS_EMITIDA: [
        (None,             STATUS_SOLICITADA),
        (STATUS_SOLICITADA, STATUS_EMITIDA),
    ],
    STATUS_APROBADA: [
        (None,             STATUS_SOLICITADA),
        (STATUS_SOLICITADA, STATUS_EMITIDA),
        (STATUS_EMITIDA,    STATUS_APROBADA),
    ],
    STATUS_RECHAZADA: [
        (None,             STATUS_SOLICITADA),
        (STATUS_SOLICITADA, STATUS_EMITIDA),
        (STATUS_EMITIDA,    STATUS_RECHAZADA),
    ],
    STATUS_FACTURADA: [
        (None,             STATUS_SOLICITADA),
        (STATUS_SOLICITADA, STATUS_EMITIDA),
        (STATUS_EMITIDA,    STATUS_APROBADA),
        (STATUS_APROBADA,   STATUS_FACTURADA),
    ],
}


def run():
    with Session(engine) as session:
        # Verificar si ya hay datos
        existing = session.exec(select(PoOrderStatusLog)).first()
        if existing:
            print("La tabla ya tiene datos. Abortando para no duplicar.")
            return

        orders = session.exec(select(PoOrder)).all()
        logs_to_insert = []

        for order in orders:
            if order.order_status_id == STATUS_BORRADOR:
                continue

            chain = CHAINS.get(order.order_status_id)
            if not chain:
                print(f"  Orden {order.id}: status_id={order.order_status_id} sin cadena definida, se omite.")
                continue

            base_date = order.created_at.date()

            # Días desde created_at según el estado al que se transiciona
            # solicitada y emitida ocurren el mismo día de creación (día 0)
            # los estados siguientes avanzan 1 día por paso
            FECHA_DELTA = {
                STATUS_SOLICITADA: 0,
                STATUS_EMITIDA:    0,
                STATUS_APROBADA:   1,
                STATUS_RECHAZADA:  1,
                STATUS_FACTURADA:  2,
            }

            for anterior_id, nuevo_id in chain:
                fecha = base_date + timedelta(days=FECHA_DELTA.get(nuevo_id, 1))
                log = PoOrderStatusLog(                    order_id=order.id,
                    status_anterior_id=anterior_id,
                    status_nuevo_id=nuevo_id,
                    usuario_id=order.solicitante_id,
                    comentario=None,
                    fecha_registro=fecha,
                )
                logs_to_insert.append(log)

        for log in logs_to_insert:
            session.add(log)

        session.commit()
        print(f"Insertados {len(logs_to_insert)} registros en po_order_status_log.")


if __name__ == "__main__":
    run()
