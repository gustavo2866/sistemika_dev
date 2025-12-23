"""
Validacion de esquema y datos para crm_eventos.
"""
from pathlib import Path
import sys

from sqlalchemy import inspect
from sqlmodel import Session, select, func

BACKEND_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db import engine
from app.models import CRMEvento, CRMTipoEvento
from app.models.enums import EstadoEvento


def validar_estructura_tabla() -> bool:
    print("\n=== VALIDACION DE ESTRUCTURA ===")
    inspector = inspect(engine)
    columns = inspector.get_columns("crm_eventos")
    column_names = {col["name"] for col in columns}

    expected = {
        "id",
        "oportunidad_id",
        "contacto_id",
        "tipo_id",
        "motivo_id",
        "titulo",
        "descripcion",
        "fecha_evento",
        "resultado",
        "estado_evento",
        "asignado_a_id",
        "created_at",
        "updated_at",
        "deleted_at",
    }
    forbidden = {
        "origen_lead_id",
        "proximo_paso",
        "fecha_compromiso",
        "fecha_recordatorio",
        "tipo_evento",
    }

    missing = expected - column_names
    extra_forbidden = forbidden & column_names

    if missing:
        print(f"WARN. Faltan columnas: {missing}")
        return False
    if extra_forbidden:
        print(f"WARN. Columnas antiguas presentes: {extra_forbidden}")
        return False

    print("OK. Estructura de tabla correcta")
    return True


def validar_indices() -> bool:
    print("\n=== VALIDACION DE INDICES ===")
    inspector = inspect(engine)
    indexes = inspector.get_indexes("crm_eventos")
    indexed_columns = set()
    for idx in indexes:
        indexed_columns.update(idx["column_names"])

    expected_indexes = {"oportunidad_id", "fecha_evento", "estado_evento", "tipo_id"}
    missing_indexes = expected_indexes - indexed_columns

    if missing_indexes:
        print(f"WARN. Faltan indices en: {missing_indexes}")
    else:
        print("OK. Indices esperados presentes")

    return True


def validar_datos() -> bool:
    print("\n=== VALIDACION DE DATOS ===")
    with Session(engine) as session:
        total = session.exec(select(func.count(CRMEvento.id))).one()
        print(f"Total de eventos: {total}")

        if total == 0:
            print("WARN. No hay eventos en la tabla")
            return True

        sin_titulo = session.exec(
            select(func.count(CRMEvento.id)).where(
                (CRMEvento.titulo.is_(None)) | (CRMEvento.titulo == "")
            )
        ).one()
        if sin_titulo > 0:
            print(f"WARN. {sin_titulo} eventos sin titulo")
            return False

        valid_ids = [item.id for item in session.exec(select(CRMTipoEvento.id)).all()]
        if not valid_ids:
            print("WARN. No hay tipos de evento en catalogo")
            return False

        tipos_invalidos = session.exec(
            select(func.count(CRMEvento.id)).where(CRMEvento.tipo_id.not_in(valid_ids))
        ).one()
        if tipos_invalidos > 0:
            print(f"WARN. {tipos_invalidos} eventos con tipo_id invalido")
            return False

        estados_invalidos = session.exec(
            select(func.count(CRMEvento.id)).where(
                CRMEvento.estado_evento.not_in([e.value for e in EstadoEvento])
            )
        ).one()
        if estados_invalidos > 0:
            print(f"WARN. {estados_invalidos} eventos con estado invalido")
            return False

        sin_oportunidad = session.exec(
            select(func.count(CRMEvento.id)).where(CRMEvento.oportunidad_id.is_(None))
        ).one()
        if sin_oportunidad > 0:
            print(f"WARN. {sin_oportunidad} eventos sin oportunidad_id")
            return False

        cerrados_sin_resultado = session.exec(
            select(func.count(CRMEvento.id))
            .where(
                CRMEvento.estado_evento.in_(
                    [
                        EstadoEvento.REALIZADO.value,
                        EstadoEvento.CANCELADO.value,
                        EstadoEvento.REAGENDAR.value,
                    ]
                )
            )
            .where((CRMEvento.resultado.is_(None)) | (CRMEvento.resultado == ""))
        ).one()
        if cerrados_sin_resultado > 0:
            print(f"WARN. {cerrados_sin_resultado} eventos cerrados sin resultado")

    print("OK. Datos validos")
    return True


def main() -> None:
    ok = validar_estructura_tabla()
    ok = validar_indices() and ok
    ok = validar_datos() and ok
    if ok:
        print("\nOK. Validacion completada")
    else:
        print("\nWARN. Hay observaciones pendientes")


if __name__ == "__main__":
    main()
