"""
Script para identificar propiedades en estado 'realizada' con vacancia activa.
"""

import os
from sqlalchemy import create_engine, text
from sqlmodel import Session
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

os.environ.setdefault("PGCLIENTENCODING", "LATIN1")

DATABASE_URL = os.getenv("DATABASE_URL")


def main() -> None:
    print("Analizando propiedades 'realizada' con vacancia activa")
    print("=" * 60)

    try:
        engine = create_engine(
            DATABASE_URL,
            connect_args={"options": "-c client_encoding=LATIN1"},
        )
    except Exception as exc:
        print(f"Error conectando a base de datos: {exc}")
        print("Verifique la variable DATABASE_URL")
        return

    query = """
    SELECT
        p.id,
        p.nombre,
        p.estado,
        p.vacancia_activa,
        p.vacancia_fecha,
        p.estado_fecha,
        p.estado_comentario,
        v.id as vacancia_id,
        v.ciclo_activo,
        v.fecha_recibida,
        v.fecha_disponible,
        v.fecha_alquilada,
        v.fecha_retirada
    FROM propiedades p
    LEFT JOIN vacancias v
        ON p.id = v.propiedad_id
        AND v.ciclo_activo = true
    WHERE p.estado = '4-realizada'
      AND p.vacancia_activa = true
    ORDER BY p.id;
    """

    try:
        with Session(engine) as session:
            session.execute(text("SET client_encoding TO 'LATIN1'"))
            rows = session.execute(text(query)).fetchall()
    except Exception as exc:
        print(f"Error ejecutando consultas: {exc}")
        return

    if not rows:
        print("OK: no se encontraron inconsistencias.")
        return

    print(f"Se encontraron {len(rows)} propiedades con inconsistencia:")
    print()
    for row in rows:
        print(f"Propiedad ID: {row.id}")
        print(f"  Nombre: {row.nombre}")
        print(f"  Estado: {row.estado}")
        print(f"  Fecha estado: {row.estado_fecha}")
        print(f"  Comentario estado: {row.estado_comentario or 'Sin comentario'}")
        print(f"  Vacancia activa: {row.vacancia_activa}")
        print(f"  Fecha vacancia: {row.vacancia_fecha}")
        if row.vacancia_id:
            print(f"  Vacancia ID: {row.vacancia_id}")
            print(f"  Ciclo activo: {row.ciclo_activo}")
            print(f"  Fecha recibida: {row.fecha_recibida}")
            print(f"  Fecha disponible: {row.fecha_disponible}")
            print(f"  Fecha alquilada: {row.fecha_alquilada}")
            print(f"  Fecha retirada: {row.fecha_retirada}")
        else:
            print("  No tiene vacancia activa en tabla vacancias")
        print("-" * 50)


if __name__ == "__main__":
    main()
