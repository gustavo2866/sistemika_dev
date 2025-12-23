"""
Verifica eventos para asegurar que tengan los campos obligatorios.
"""
from sqlmodel import Session, select

from app.db import engine
from app.models.crm_evento import CRMEvento


def verificar_eventos() -> None:
    with Session(engine) as session:
        eventos = session.exec(
            select(CRMEvento).where(CRMEvento.deleted_at.is_(None))
        ).all()

        print("\n" + "=" * 70)
        print("VERIFICACION DE EVENTOS")
        print("=" * 70)
        print(f"\nTotal de eventos: {len(eventos)}\n")

        eventos_problematicos = []

        for evento in eventos:
            problemas = []

            if not evento.oportunidad_id:
                problemas.append("Sin oportunidad_id")
            if not evento.titulo or not evento.titulo.strip():
                problemas.append("Sin titulo")
            if not evento.fecha_evento:
                problemas.append("Sin fecha_evento")
            if not evento.asignado_a_id:
                problemas.append("Sin responsable (asignado_a_id)")
            if not evento.estado_evento:
                problemas.append("Sin estado_evento")
            if not evento.tipo_id:
                problemas.append("Sin tipo_id")

            if problemas:
                eventos_problematicos.append((evento, problemas))
                print(f"Evento #{evento.id}:")
                for problema in problemas:
                    print(f"  - {problema}")
                print(f"  Actual - Titulo: {evento.titulo}")
                print(f"  Actual - Oportunidad: {evento.oportunidad_id}")
                print(f"  Actual - Fecha: {evento.fecha_evento}")
                print(f"  Actual - Responsable: {evento.asignado_a_id}")
                print(f"  Actual - Estado: {evento.estado_evento}")
                print(f"  Actual - Tipo: {evento.tipo_id}")
                print()

        print("=" * 70)
        if eventos_problematicos:
            print(f"WARN. {len(eventos_problematicos)} eventos con problemas encontrados")
        else:
            print("OK. Todos los eventos tienen los campos obligatorios")
        print("=" * 70 + "\n")


if __name__ == "__main__":
    verificar_eventos()
