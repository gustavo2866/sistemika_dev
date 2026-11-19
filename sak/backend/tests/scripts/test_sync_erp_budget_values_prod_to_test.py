from datetime import date
from decimal import Decimal

import pytest

from scripts.sync_erp_budget_values_prod_to_test import build_plan


PROJECTS = {1: {"nombre": "Obra", "centro_costo": 10}}
ACCOUNTS = {2: {"cod_cuenta": "5.01"}, 3: {"cod_cuenta": "5.02"}}


def row(record_id, month, *, account=2, income=0, expense=0):
    return dict(id=record_id, version=4, fecha=date(2026, month, 15), proyecto_id=1,
                erp_cuenta_id=account, ingres=Decimal(income), egreso=Decimal(expense),
                real_ingreso=Decimal("11"), real_egreso=Decimal("12"),
                obreros_cantidad=Decimal("3"), obreros_costo=Decimal("20"),
                proyecto_nombre="Obra", centro_costo=10, cod_cuenta=ACCOUNTS[account]["cod_cuenta"])


def test_plan_actualiza_presupuesto_crea_diciembre_y_limpia_solo_importes_ausentes():
    source = [row(20, 11, income=100, expense=80), row(21, 12, income=200, expense=150)]
    target = [row(1, 11, income=90, expense=70), row(2, 11, account=3, expense=50)]
    plan = build_plan(source, target, PROJECTS, ACCOUNTS)
    assert plan["updates"] == [
        {"id": 1, "version": 4, "ingres": Decimal(100), "egreso": Decimal(80)},
        {"id": 2, "version": 4, "ingres": Decimal(0), "egreso": Decimal(0)},
    ]
    assert plan["inserts"] == [dict(fecha=date(2026, 12, 1), proyecto_id=1,
                                    erp_cuenta_id=2, ingres=Decimal(200), egreso=Decimal(150))]
    assert target[0]["real_egreso"] == Decimal("12")
    assert target[0]["obreros_cantidad"] == Decimal("3")


@pytest.mark.parametrize("duplicate_in_source", [True, False])
def test_plan_rechaza_duplicados_mensuales_aunque_las_fechas_sean_distintas(duplicate_in_source):
    rows = [row(1, 11), {**row(2, 11), "fecha": date(2026, 11, 1)}]
    with pytest.raises(ValueError, match="duplicado"):
        build_plan(rows if duplicate_in_source else [], [] if duplicate_in_source else rows, PROJECTS, ACCOUNTS)


def test_plan_no_asume_que_ids_iguales_son_la_misma_cuenta_o_proyecto():
    with pytest.raises(ValueError, match="proyecto"):
        build_plan([row(1, 11)], [], {1: {"nombre": "Otra obra", "centro_costo": 99}}, ACCOUNTS)
    with pytest.raises(ValueError, match="cuenta"):
        build_plan([row(1, 11)], [], PROJECTS, {2: {"cod_cuenta": "5.99"}})


def test_plan_es_idempotente_y_no_copia_reales_para_filas_sin_presupuesto():
    source = [row(1, 11, expense=50), row(2, 12)]
    target = [row(3, 11, expense=50)]
    assert build_plan(source, target, PROJECTS, ACCOUNTS) == {"updates": [], "inserts": []}
