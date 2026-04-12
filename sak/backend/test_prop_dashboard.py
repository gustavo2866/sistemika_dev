"""
Prueba exhaustiva endpoints /api/dashboard/propiedades
Compara respuestas de API contra cálculos directos sobre la DB.
"""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from typing import Any

import httpx

BASE = "http://localhost:8000/api/dashboard/propiedades"
PASS = []
FAIL = []


def ok(label: str):
    PASS.append(label)
    print(f"  [OK] {label}")


def fail(label: str, detail: str = ""):
    FAIL.append(label)
    print(f"  [FAIL] {label}")
    if detail:
        print(f"     -> {detail}")


def get(path: str, **params) -> Any:
    url = f"{BASE}{path}"
    r = httpx.get(url, params=params, timeout=20)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


# ─────────────────────────────────────────────────────────────────
# Datos de referencia directos desde la DB
# ─────────────────────────────────────────────────────────────────
def load_db_reference():
    from app.db import get_session
    from app.models.propiedad import Propiedad, PropiedadesStatus, PropiedadesLogStatus
    from app.models.crm.catalogos import CRMTipoOperacion
    from sqlmodel import select
    from sqlalchemy import func

    with next(get_session()) as s:
        rows = s.exec(
            select(Propiedad, PropiedadesStatus)
            .where(Propiedad.deleted_at.is_(None))
            .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id, isouter=True)
        ).all()

        today = date.today()
        ALERT_DAYS = 60

        def grupo(tipo_op_id=None, emp_id=None):
            filtered = [
                (p, st) for p, st in rows
                if (tipo_op_id is None or p.tipo_operacion_id == tipo_op_id)
                and (emp_id is None or p.emprendimiento_id == emp_id)
            ]
            recibida = sum(1 for p, st in filtered if st and st.orden == 1)
            en_rep    = sum(1 for p, st in filtered if st and st.orden == 2)
            disp      = sum(1 for p, st in filtered if st and st.orden == 3)
            realizada = sum(1 for p, st in filtered if st and st.orden == 4)
            retirada  = sum(1 for p, st in filtered if st and "retirada" in (st.nombre or "").lower())

            venc_lt60 = sum(
                1 for p, st in filtered
                if st and st.orden == 4 and p.vencimiento_contrato
                and 0 <= (p.vencimiento_contrato - today).days < ALERT_DAYS
            )
            renov_lt60 = sum(
                1 for p, st in filtered
                if st and st.orden == 4 and p.fecha_renovacion
                and (not p.vencimiento_contrato or p.fecha_renovacion <= p.vencimiento_contrato)
                and 0 <= (p.fecha_renovacion - today).days < ALERT_DAYS
            )
            lt_30 = sum(
                1 for p, st in filtered
                if st and "retirada" in (st.nombre or "").lower()
                and p.estado_fecha and (today - p.estado_fecha).days <= 30
            )
            gt_30 = sum(
                1 for p, st in filtered
                if st and "retirada" in (st.nombre or "").lower()
                and p.estado_fecha and (today - p.estado_fecha).days > 30
            )
            return {
                "recibida": recibida,
                "en_reparacion": en_rep,
                "disponible": disp,
                "realizada": realizada,
                "retirada": retirada,
                "vencimiento_lt_60": venc_lt60,
                "renovacion_lt_60": renov_lt60,
                "lt_30": lt_30,
                "gt_30": gt_30,
            }

        def kpi_vacancia(start: date, end: date, tipo_op_id=None, emp_id=None):
            filtered = [
                (p, st) for p, st in rows
                if (tipo_op_id is None or p.tipo_operacion_id == tipo_op_id)
                and (emp_id is None or p.emprendimiento_id == emp_id)
            ]
            vacant = [(p, st) for p, st in filtered if st and st.orden in (1, 2, 3)]
            dias_activas = [
                max(0, (end - p.vacancia_fecha).days)
                for p, st in vacant
                if p.vacancia_fecha
            ]
            return {
                "vacantes_activas_count": len(vacant),
                "vacantes_activas_dias_promedio": round(
                    sum(dias_activas) / len(dias_activas), 1
                ) if dias_activas else 0,
            }

        return {"grupo": grupo, "kpi_vacancia": kpi_vacancia, "rows": rows}


# ─────────────────────────────────────────────────────────────────
# SECCIÓN 1: /selectors
# ─────────────────────────────────────────────────────────────────
def test_selectors(ref):
    print("\n" + "=" * 60)
    print("SECCIÓN 1: /selectors")
    print("=" * 60)

    combos = [
        ("Sin filtros",      {}),
        ("Alquiler id=1",    {"tipoOperacionId": "1"}),
        ("Venta id=2",       {"tipoOperacionId": "2"}),
        ("todos explícito",  {"tipoOperacionId": "todos"}),
    ]

    for label, params in combos:
        tipo_id = int(params["tipoOperacionId"]) if params.get("tipoOperacionId") not in (None, "todos") else None
        expected = ref["grupo"](tipo_op_id=tipo_id)
        data = get("/selectors", **params)

        checks = [
            ("recibida.count",      data["recibida"]["count"],         expected["recibida"]),
            ("en_reparacion.count", data["en_reparacion"]["count"],    expected["en_reparacion"]),
            ("disponible.count",    data["disponible"]["count"],       expected["disponible"]),
            ("realizada.count",     data["realizada"]["count"],        expected["realizada"]),
            ("retirada.count",      data["retirada"]["count"],         expected["retirada"]),
            ("realizada.vencimiento_lt_60", data["realizada"]["vencimiento_lt_60"], expected["vencimiento_lt_60"]),
            ("realizada.renovacion_lt_60",  data["realizada"]["renovacion_lt_60"],  expected["renovacion_lt_60"]),
            ("retirada.lt_30",      data["retirada"]["lt_30"],         expected["lt_30"]),
            ("retirada.gt_30",      data["retirada"]["gt_30"],         expected["gt_30"]),
        ]

        for field, got, exp in checks:
            lbl = f"selectors[{label}].{field}"
            if got == exp:
                ok(lbl)
            else:
                fail(lbl, f"esperado={exp}, obtenido={got}")

    # Coherencia: alquiler + venta = total
    d_all  = ref["grupo"]()
    d_alq  = ref["grupo"](tipo_op_id=1)
    d_vnt  = ref["grupo"](tipo_op_id=2)
    for k in ("recibida", "en_reparacion", "disponible", "realizada", "retirada"):
        if d_alq[k] + d_vnt[k] == d_all[k]:
            ok(f"coherencia-suma[{k}]: alquiler+venta==total")
        else:
            fail(f"coherencia-suma[{k}]", f"{d_alq[k]}+{d_vnt[k]}!={d_all[k]}")


# ─────────────────────────────────────────────────────────────────
# SECCIÓN 2: /bundle — KPIs
# ─────────────────────────────────────────────────────────────────
def test_bundle_kpis(ref):
    print("\n" + "=" * 60)
    print("SECCIÓN 2: /bundle — KPIs y period_summary")
    print("=" * 60)

    testcases = [
        ("Trim Ene-Mar 2026 / sin filtro",  "2026-01-01", "2026-03-31", "trimestre", None),
        ("Trim Ene-Mar 2026 / Alquiler",    "2026-01-01", "2026-03-31", "trimestre", 1),
        ("Trim Ene-Mar 2026 / Venta",       "2026-01-01", "2026-03-31", "trimestre", 2),
        ("Mes Feb 2026 / sin filtro",       "2026-02-01", "2026-02-28", "mes",       None),
        ("Mes Ene 2026 / Alquiler",         "2026-01-01", "2026-01-31", "mes",       1),
        ("Semestre Jul-Dic 2025 / sin fil", "2025-07-01", "2025-12-31", "semestre",  None),
    ]

    for label, start, end, period, tipo_id in testcases:
        params = {"startDate": start, "endDate": end, "periodType": period}
        if tipo_id:
            params["tipoOperacionId"] = str(tipo_id)

        data = get("/bundle", **params)
        cur = data["current"]

        s = date.fromisoformat(start)
        e = date.fromisoformat(end)
        db_kpi = ref["kpi_vacancia"](s, e, tipo_op_id=tipo_id)
        db_g   = ref["grupo"](tipo_op_id=tipo_id)

        print(f"\n  [{label}]")

        # Días vacancia periodo: total >= 0 y estructuralmente válido
        dias_kpi = cur["kpis"]["dias_vacancia_periodo"]
        lbl = f"bundle/{label}.kpis.dias_vacancia_periodo.total >= 0"
        if isinstance(dias_kpi["total"], int) and dias_kpi["total"] >= 0:
            ok(lbl)
        else:
            fail(lbl, f"obtenido={dias_kpi['total']}")

        # por_estado: estructura presente y valores >= 0
        por_estado = dias_kpi.get("por_estado", {})
        for estado_key in ("recibida", "en_reparacion", "disponible"):
            lbl = f"bundle/{label}.kpis.dias_vacancia_periodo.por_estado.{estado_key} >= 0"
            val = por_estado.get(estado_key)
            if isinstance(val, int) and val >= 0:
                ok(lbl)
            else:
                fail(lbl, f"obtenido={val}")

        # suma por_estado == total
        lbl = f"bundle/{label}.kpis.dias_vacancia_periodo.por_estado suma == total"
        suma = sum(por_estado.get(k, 0) for k in ("recibida", "en_reparacion", "disponible"))
        if suma == dias_kpi["total"]:
            ok(lbl)
        else:
            fail(lbl, f"suma={suma}, total={dias_kpi['total']}")

        # period_summary.activas_fin es entero válido
        ps = cur["period_summary"]
        lbl = f"bundle/{label}.period_summary.activas_fin es entero"
        if isinstance(ps["activas_fin"], int):
            ok(lbl)
        else:
            fail(lbl, f"obtenido={ps['activas_fin']}")




# ─────────────────────────────────────────────────────────────────
# SECCIÓN 3: /bundle — trend y previous
# ─────────────────────────────────────────────────────────────────
def test_bundle_trend():
    print("\n" + "=" * 60)
    print("SECCIÓN 3: /bundle — trend y previous range")
    print("=" * 60)

    data = get("/bundle", startDate="2026-01-01", endDate="2026-03-31",
               periodType="trimestre", trendSteps="-3,-2,-1,0")

    trend = data["trend"]
    lbl = "bundle.trend.length == 4"
    if len(trend) == 4:
        ok(lbl)
    else:
        fail(lbl, f"obtenido={len(trend)}")

    # Último bucket (step=0) debe ser el período actual
    last = trend[-1]
    lbl = "bundle.trend[-1].bucket starts with T1"
    if "T1" in last["bucket"]:
        ok(lbl)
    else:
        fail(lbl, f"obtenido={last['bucket']}")

    # variacion_vs_anterior en dias_vacancia_periodo
    lbl = "bundle.current.kpis.dias_vacancia_periodo.variacion_vs_anterior presente"
    if "variacion_vs_anterior" in data["current"]["kpis"]["dias_vacancia_periodo"]:
        ok(lbl)
    else:
        fail(lbl)

    # Todos los trends tienen los campos esperados
    for i, t in enumerate(trend):
        for campo in ("bucket", "count_vacantes", "dias_total"):
            lbl = f"bundle.trend[{i}].{campo} presente"
            if campo in t:
                ok(lbl)
            else:
                fail(lbl)


# ─────────────────────────────────────────────────────────────────
# SECCIÓN 4: /detalle
# ─────────────────────────────────────────────────────────────────
def test_detalle(ref):
    print("\n" + "=" * 60)
    print("SECCIÓN 4: /detalle")
    print("=" * 60)

    selector_keys = ["recibida", "en_reparacion", "disponible", "realizada", "retirada"]
    db = ref["grupo"]()

    expected_map = {
        "recibida":      db["recibida"],
        "en_reparacion": db["en_reparacion"],
        "disponible":    db["disponible"],
        "realizada":     db["realizada"],
        "retirada":      db["retirada"],
    }

    for sk in selector_keys:
        data = get("/detalle", selectorKey=sk, pageSize=200)
        lbl = f"detalle[{sk}].total == DB count"
        if data["total"] == expected_map[sk]:
            ok(lbl)
        else:
            fail(lbl, f"esperado={expected_map[sk]}, obtenido={data['total']}")

        # Todos los items tienen propiedad_id y estado válido
        for item in data["data"]:
            if not item.get("propiedad_id"):
                fail(f"detalle[{sk}].item sin propiedad_id")
            if not item.get("nombre"):
                fail(f"detalle[{sk}].item sin nombre")

    # Sub-bucket: vencimiento_lt_60
    d_venc = get("/detalle", selectorKey="realizada", subBucket="vencimiento_lt_60", pageSize=200)
    lbl = "detalle[realizada/vencimiento_lt_60].total == DB count"
    if d_venc["total"] == db["vencimiento_lt_60"]:
        ok(lbl)
    else:
        fail(lbl, f"esperado={db['vencimiento_lt_60']}, obtenido={d_venc['total']}")

    # Sub-bucket: renovacion_lt_60
    d_renov = get("/detalle", selectorKey="realizada", subBucket="renovacion_lt_60", pageSize=200)
    lbl = "detalle[realizada/renovacion_lt_60].total == DB count"
    if d_renov["total"] == db["renovacion_lt_60"]:
        ok(lbl)
    else:
        fail(lbl, f"esperado={db['renovacion_lt_60']}, obtenido={d_renov['total']}")

    # Sub-bucket: retirada lt_30 y gt_30
    d_lt30 = get("/detalle", selectorKey="retirada", subBucket="lt_30", pageSize=200)
    lbl = "detalle[retirada/lt_30].total == DB count"
    if d_lt30["total"] == db["lt_30"]:
        ok(lbl)
    else:
        fail(lbl, f"esperado={db['lt_30']}, obtenido={d_lt30['total']}")

    d_gt30 = get("/detalle", selectorKey="retirada", subBucket="gt_30", pageSize=200)
    lbl = "detalle[retirada/gt_30].total == DB count"
    if d_gt30["total"] == db["gt_30"]:
        ok(lbl)
    else:
        fail(lbl, f"esperado={db['gt_30']}, obtenido={d_gt30['total']}")

    # Paginación: page=1 pageSize=5 -> data len <= 5
    d_pag = get("/detalle", selectorKey="disponible", page=1, pageSize=5)
    lbl = "detalle.paginacion: data len <= pageSize"
    if len(d_pag["data"]) <= 5:
        ok(lbl)
    else:
        fail(lbl, f"obtenido len={len(d_pag['data'])}")

    # Paginación: total consistente entre páginas
    d_p1 = get("/detalle", selectorKey="disponible", page=1, pageSize=10)
    d_p2 = get("/detalle", selectorKey="disponible", page=2, pageSize=10)
    lbl = "detalle.paginacion: page1.total == page2.total"
    if d_p1["total"] == d_p2["total"]:
        ok(lbl)
    else:
        fail(lbl, f"p1.total={d_p1['total']} != p2.total={d_p2['total']}")

    # Filtro por tipoOperacionId
    d_alq = get("/detalle", selectorKey="disponible", tipoOperacionId="1", pageSize=200)
    d_vnt = get("/detalle", selectorKey="disponible", tipoOperacionId="2", pageSize=200)
    sum_filter = d_alq["total"] + d_vnt["total"]
    total_sin_filtro = get("/detalle", selectorKey="disponible", pageSize=200)["total"]
    lbl = "detalle[disponible]: alquiler+venta == total"
    if sum_filter == total_sin_filtro:
        ok(lbl)
    else:
        fail(lbl, f"{d_alq['total']}+{d_vnt['total']}={sum_filter} != {total_sin_filtro}")

    # Verificar que días de vacancia son >= 0 en items
    d_all = get("/detalle", selectorKey="recibida", pageSize=200)
    neg_dias = [i for i in d_all["data"] if i.get("dias_vacancia", 0) < 0]
    lbl = "detalle[recibida]: dias_vacancia >= 0 en todos los items"
    if not neg_dias:
        ok(lbl)
    else:
        fail(lbl, f"{len(neg_dias)} items con dias_vacancia negativo: {[i['propiedad_id'] for i in neg_dias]}")


# ─────────────────────────────────────────────────────────────────
# SECCIÓN 5: /detalle-alerta
# ─────────────────────────────────────────────────────────────────
def test_detalle_alerta(ref):
    print("\n" + "=" * 60)
    print("SECCIÓN 5: /detalle-alerta")
    print("=" * 60)

    db = ref["grupo"]()
    today = date.today()

    for ak in ("vencimiento_lt_60", "renovacion_lt_60"):
        data = get("/detalle-alerta", alertKey=ak, pageSize=200)
        exp = db[ak]
        lbl = f"detalle-alerta[{ak}].total == DB count"
        if data["total"] == exp:
            ok(lbl)
        else:
            fail(lbl, f"esperado={exp}, obtenido={data['total']}")

        # Verificar que los items tienen los campos de alerta
        for item in data["data"]:
            k_dias = "dias_para_vencimiento" if ak == "vencimiento_lt_60" else "dias_para_renovacion"
            lbl_item = f"detalle-alerta[{ak}].item.{k_dias} presente y >=0"
            v = item.get(k_dias)
            if v is not None and v >= 0:
                ok(lbl_item)
            else:
                fail(lbl_item, f"id={item.get('propiedad_id')} {k_dias}={v}")

    # Alerta con pivotDate futuro (+30d): la ventana se amplía hacia adelante,
    # por lo que deben entrar >=  los mismos items que sin pivotDate.
    pivot_30 = (today + timedelta(days=30)).isoformat()
    d_piv = get("/detalle-alerta", alertKey="renovacion_lt_60", pivotDate=pivot_30, pageSize=200)
    lbl = "detalle-alerta.con pivotDate futuro: total >= total sin pivotDate"
    d_base = get("/detalle-alerta", alertKey="renovacion_lt_60", pageSize=200)
    if d_piv["total"] >= d_base["total"]:
        ok(lbl)
    else:
        fail(lbl, f"piv={d_piv['total']} < base={d_base['total']}")

    # Filtro tipoOperacion
    d1 = get("/detalle-alerta", alertKey="renovacion_lt_60", tipoOperacionId="1", pageSize=200)
    d2 = get("/detalle-alerta", alertKey="renovacion_lt_60", tipoOperacionId="2", pageSize=200)
    d_tot = get("/detalle-alerta", alertKey="renovacion_lt_60", pageSize=200)
    lbl = "detalle-alerta: alquiler+venta == total (renovacion_lt_60)"
    if d1["total"] + d2["total"] == d_tot["total"]:
        ok(lbl)
    else:
        fail(lbl, f"{d1['total']}+{d2['total']} != {d_tot['total']}")


# ─────────────────────────────────────────────────────────────────
# SECCIÓN 6: Coherencia cruzada entre endpoints
# ─────────────────────────────────────────────────────────────────
def test_coherencia_cruzada():
    print("\n" + "=" * 60)
    print("SECCIÓN 6: Coherencia cruzada entre endpoints")
    print("=" * 60)

    today = date.today()
    start_trim = date(today.year, ((today.month - 1) // 3) * 3 + 1, 1).isoformat()
    # last day of current quarter
    end_month = ((today.month - 1) // 3) * 3 + 3
    import calendar
    end_day = calendar.monthrange(today.year, end_month)[1]
    end_trim = date(today.year, end_month, end_day).isoformat()

    bundle = get("/bundle", startDate=start_trim, endDate=end_trim, periodType="trimestre")
    selectors = get("/selectors")

    cur = bundle["current"]

    # selectors endpoint vs bundle.kpis — ambos deben ser enteros válidos
    for sk in ("recibida", "en_reparacion", "disponible", "realizada", "retirada"):
        lbl = f"coherencia: selectors.{sk}.count es entero válido"
        val_sel = selectors[sk]["count"]
        if isinstance(val_sel, int):
            ok(lbl)
        else:
            fail(lbl, f"sel={val_sel}")

    # kpis.dias_vacancia_periodo.total == activas_fin (coherencia interna del bundle)
    activas_fin = cur["period_summary"]["activas_fin"]

    # detalle total para cada selector coincide con bundle.selectors count (aproximado)
    for sk, bun_key in [("recibida", "recibida"), ("en_reparacion", "en_reparacion"),
                        ("disponible", "disponible"), ("realizada", "realizada"), ("retirada", "retirada")]:
        d = get("/detalle", selectorKey=sk, pageSize=1)
        sel = get("/selectors")
        lbl = f"coherencia: detalle[{sk}].total == selectors.{sk}.count"
        if d["total"] == sel[sk]["count"]:
            ok(lbl)
        else:
            fail(lbl, f"detalle={d['total']} sel={sel[sk]['count']}")

    # period_summary.activas_fin es coherente con selectors
    sel_vac = selectors["recibida"]["count"] + selectors["en_reparacion"]["count"] + selectors["disponible"]["count"]
    lbl = "coherencia: selectors(r+e+d) == period_summary.activas_fin"
    if sel_vac == activas_fin:
        ok(lbl)
    else:
        fail(lbl, f"{sel_vac} != {activas_fin}")


# ─────────────────────────────────────────────────────────────────
# SECCIÓN 7: Edge cases
# ─────────────────────────────────────────────────────────────────
def test_edge_cases():
    print("\n" + "=" * 60)
    print("SECCIÓN 7: Edge cases")
    print("=" * 60)

    # Período muy antiguo (sin datos)
    data = get("/bundle", startDate="2010-01-01", endDate="2010-03-31", periodType="trimestre")
    lbl = "bundle.periodo_antiguo: dias_vacancia_periodo.total == 0"
    got_cnt = data["current"]["kpis"]["dias_vacancia_periodo"]["total"]
    if got_cnt == 0:
        ok(lbl)
    else:
        fail(lbl, f"obtenido={got_cnt}")

    # Período futuro
    data_fut = get("/bundle", startDate="2030-01-01", endDate="2030-03-31", periodType="trimestre")
    lbl = "bundle.periodo_futuro: retorna sin error"
    ok(lbl)

    # selectorKey inválido debe retornar 0 items (no leak de todos los registros)
    try:
        d = get("/detalle", selectorKey="inexistente", pageSize=10)
        lbl = "detalle.selectorKey_invalido: total == 0"
        if d["total"] == 0:
            ok(lbl)
        else:
            fail(lbl, f"obtenido={d['total']} (se esperaba 0)")
    except RuntimeError as e:
        fail("detalle.selectorKey_invalido: error inesperado", str(e))

    # alertKey inválido debería dar 0 items (el filtro no matchea ninguno)
    try:
        d = get("/detalle-alerta", alertKey="inexistente", pageSize=10)
        lbl = "detalle-alerta.alertKey_invalido: total == 0"
        if d["total"] == 0:
            ok(lbl)
        else:
            fail(lbl, f"obtenido={d['total']}")
    except RuntimeError as e:
        fail("detalle-alerta.alertKey_invalido", str(e))

    # Paginación página fuera de rango
    d = get("/detalle", selectorKey="disponible", page=9999, pageSize=10)
    lbl = "detalle.page_fuera_rango: data == [] sin error"
    if d["data"] == [] and isinstance(d["total"], int):
        ok(lbl)
    else:
        fail(lbl, f"data_len={len(d['data'])} total={d['total']}")


# ─────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Cargando datos de referencia desde DB...")
    ref = load_db_reference()
    print("OK")

    test_selectors(ref)
    test_bundle_kpis(ref)
    test_bundle_trend()
    test_detalle(ref)
    test_detalle_alerta(ref)
    test_coherencia_cruzada()
    test_edge_cases()

    total = len(PASS) + len(FAIL)
    print()
    print("=" * 60)
    print(f"RESULTADO: {len(PASS)}/{total} pasaron   ({len(FAIL)} fallaron)")
    print("=" * 60)
    if FAIL:
        print("\nFALLIDOS:")
        for f in FAIL:
            print(f"  ✗ {f}")
        sys.exit(1)
    else:
        print("Todos los tests pasaron [OK]")
