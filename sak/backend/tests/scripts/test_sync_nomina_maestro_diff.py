from datetime import date
from types import SimpleNamespace

from app.models.nomina import Nomina
from scripts.import_nomina_maestro import MaestroRow
from scripts.sync_nomina_maestro_diff import (
    RowChange,
    apply_baja_to_nomina,
    apply_row_to_nomina,
    compute_diff,
    extract_project_alias,
    resolve_project_id,
)


def _row(*, legajo: str, nombre: str, obra: str, categoria: str, tarea: str) -> MaestroRow:
    return MaestroRow(
        nro_legajo=legajo,
        nombre_completo=nombre,
        obra=obra,
        categoria_code=categoria,
        tarea_code=tarea,
    )


def test_compute_diff_detecta_altas_bajas_y_cambios() -> None:
    base = [
        _row(legajo="1", nombre="PEREZ JUAN", obra="OBRA A", categoria="AY", tarea="A"),
        _row(legajo="2", nombre="GOMEZ ANA", obra="OBRA B", categoria="OF", tarea="E"),
    ]
    new = [
        _row(legajo="1", nombre="PEREZ JUAN", obra="OBRA C", categoria="AY", tarea="A"),
        _row(legajo="3", nombre="LOPEZ LUIS", obra="OBRA B", categoria="OF", tarea="E"),
    ]

    added, removed, changed = compute_diff(base, new)

    assert [row.nro_legajo for row in added] == ["3"]
    assert [row.nro_legajo for row in removed] == ["2"]
    assert changed == [
        RowChange(
            legajo="1",
            before=base[0],
            after=new[0],
            changed_fields=("obra",),
        )
    ]


def test_apply_row_to_nomina_actualiza_y_reactiva() -> None:
    nomina = Nomina(
        nombre="Viejo",
        apellido="Nombre",
        dni="501000",
        nro_legajo="501000",
        activo=False,
        fecha_egreso=date(2026, 9, 30),
    )
    row = _row(
        legajo="501000",
        nombre="PEREZ JUAN",
        obra="OBRA A",
        categoria="AY",
        tarea="E",
    )

    warnings = apply_row_to_nomina(
        nomina,
        row,
        exact_project_ids={"OBRA A": 10},
        fuzzy_projects=[("OBRA A", 10)],
        categoria_id_by_code={"AY": 20},
        tarea_id_by_code={"E": 30},
    )

    assert warnings == []
    assert nomina.nombre == "JUAN"
    assert nomina.apellido == "PEREZ"
    assert nomina.idproyecto == 10
    assert nomina.nomina_categoria_id == 20
    assert nomina.nomina_tarea_id == 30
    assert nomina.activo is True
    assert nomina.fecha_egreso is None
    assert nomina.dni == "501000"


def test_apply_baja_to_nomina_marca_inactivo_y_fecha_egreso() -> None:
    nomina = Nomina(nombre="Ana", apellido="Gomez", dni="123", activo=True)

    changed = apply_baja_to_nomina(nomina, fecha_corte=date(2026, 10, 2))

    assert changed is True
    assert nomina.activo is False
    assert nomina.fecha_egreso == date(2026, 10, 2)


def test_resolve_project_id_usa_alias_de_obra() -> None:
    project_id = resolve_project_id(
        "LA RIOJA 474 / ALBAÑILERIA",
        exact_project_ids={"INST. SANITARIA": 21},
        fuzzy_projects=[
            ("LA RIOJA 474 BOREAL", 10),
            ("TORRES SP SRL SOLANA YERBA S N SAN PABLO", 14),
        ],
    )

    assert extract_project_alias("TORRES S.P (NICOLAS)") == "TORRES S.P"
    assert project_id == 10