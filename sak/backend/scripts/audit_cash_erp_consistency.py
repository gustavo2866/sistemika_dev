"""Auditoría de solo lectura entre Cash, libros locales y ERP original."""
import json
import sys
from collections import Counter, defaultdict
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg
from psycopg.rows import dict_row
from sqlalchemy import text
from sqlmodel import Session, select

from app.db import engine
from app.models.erp.cash_subcta import ErpCashSubcta
from app.models.erp.libro_diario_sync import get_source_connection_kwargs
from app.services.erp_cash_mapping_service import (
    build_cash_mappings_by_key, get_fondo_mappings_by_cuenta, resolve_cash_account_id,
)
from app.services.erp_cash_reconciliation_service import reconcile_cash


def canonical(value):
    value = str(value or "").strip()
    return str(int(value)) if value.isdigit() else value


def entry_key(row):
    return (row["empresa_id"], row["fecha"], canonical(row["tipo_asiento"]), canonical(row["nro_asiento"]))


def movement_key(row):
    return (*entry_key(row), canonical(row["nro_renglon"]), row["cuenta_codigo"],
            canonical(row["tipo_subcuenta"]), canonical(row["nro_subcuenta"]), canonical(row["centro_costo"]))


def balance_key(row):
    return (row["empresa_id"], row["periodo_anio"], row["periodo_mes"], row["cuenta_codigo"],
            canonical(row["tipo_subcuenta"]), canonical(row["nro_subcuenta"]), canonical(row["centro_costo"]))


def grouped(rows, key, fields):
    result = {}
    for row in rows:
        group = result.setdefault(key(row), dict(count=0, **{f: Decimal(0) for f in fields}))
        group["count"] += 1
        for field in fields:
            group[field] += Decimal(row[field] or 0)
    return result


def compare(actual, expected, key, fields):
    a, e = grouped(actual, key, fields), grouped(expected, key, fields)
    missing, extra = sorted(set(e) - set(a), key=str), sorted(set(a) - set(e), key=str)
    differences = []
    multiplicity = []
    for identity in sorted(set(a) & set(e), key=str):
        changes = {f: {"actual": a[identity][f], "erp": e[identity][f],
                       "diferencia": a[identity][f] - e[identity][f]}
                   for f in fields if a[identity][f] != e[identity][f]}
        if changes:
            differences.append({"clave": identity, "campos": changes})
        if a[identity]["count"] != e[identity]["count"]:
            multiplicity.append({"clave": identity, "actual": a[identity]["count"], "erp": e[identity]["count"]})
    return dict(filas_actuales=len(actual), filas_esperadas=len(expected), grupos_comparados=len(set(a) & set(e)),
        faltantes=len(missing), adicionales=len(extra), importes_distintos=len(differences),
        multiplicidad_distinta=len(multiplicity), detalle_faltantes=missing[:50],
        detalle_adicionales=extra[:50], detalle_importes=differences[:50], detalle_multiplicidad=multiplicity[:50])


def main():
    report = {"inicio_utc": datetime.now(UTC), "empresas": [1, 2, 5]}
    with Session(engine) as session:
        session.exec(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
        session.exec(text("SET LOCAL statement_timeout='60s'"))
        funds = get_fondo_mappings_by_cuenta(session)
        period_rows = [dict(r) for r in session.exec(text("""SELECT fecha_periodo,estado,
            ultima_sincronizacion,movimientos_count,saldos_count FROM erp_cash_periodos
            WHERE deleted_at IS NULL ORDER BY fecha_periodo""")).mappings()]
        cash = [dict(r) for r in session.exec(text("""SELECT * FROM erp_cash_diarios
            WHERE deleted_at IS NULL AND periodo_anio>=2026""")).mappings()]
        balances = [dict(r) for r in session.exec(text("""SELECT * FROM erp_cash_saldos
            WHERE deleted_at IS NULL AND nivel='subcuenta' AND
            (periodo_anio>=2026 OR (periodo_anio=2025 AND periodo_mes=12))""")).mappings()]
        diary = [dict(r) for r in session.exec(text("""SELECT * FROM erp_libro_diario
            WHERE deleted_at IS NULL AND periodo_anio>=2026 AND empresa_id IN (1,2,5)""")).mappings()]
        mayor = [dict(r) for r in session.exec(text("""SELECT * FROM erp_libro_mayor
            WHERE deleted_at IS NULL AND nivel='subcuenta' AND periodo_anio>=2026
            AND empresa_id IN (1,2,5)""")).mappings()]
        print("Snapshot local cargado", flush=True)
        with psycopg.connect(**get_source_connection_kwargs(), connect_timeout=20, row_factory=dict_row) as conn:
            conn.read_only = True
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
                cur.execute("SET LOCAL statement_timeout='60s'")
                cur.execute("SELECT now() AS snapshot_utc")
                report["snapshot_erp_utc"] = cur.fetchone()["snapshot_utc"]
                cur.execute("""SELECT id AS source_id,empresa_id,fecha,periodo_anio,periodo_mes,
                    tipo_asiento,nro_asiento,nro_renglon,cuenta_codigo,debe,haber,
                    tipo_subcuenta,nro_subcuenta,centro_costo FROM public.libro_diario
                    WHERE periodo_anio>=2026 AND empresa_id=ANY(%s)""", ([1,2,5],))
                erp_diary = cur.fetchall()
                cur.execute("""SELECT id AS source_id,empresa_id,periodo_anio,periodo_mes,nivel,
                    cuenta_codigo,tipo_subcuenta,nro_subcuenta,centro_costo,total_debe,total_haber,
                    saldo_anterior,saldo_periodo,saldo_acumulado FROM public.libro_mayor
                    WHERE empresa_id=ANY(%s) AND cuenta_codigo=ANY(%s)
                      AND (periodo_anio>=2026 OR (periodo_anio=2025 AND periodo_mes=12))
                      AND nivel IN ('cuenta','subcuenta')""", ([1,2,5],list(funds)))
                erp_balances_all = cur.fetchall()
        print("Snapshot ERP cargado", flush=True)
        erp_cash_entries = {entry_key(r) for r in erp_diary if r["cuenta_codigo"] in funds}
        erp_cash = [r for r in erp_diary if entry_key(r) in erp_cash_entries]
        local_cash_entries = {entry_key(r) for r in diary if r["cuenta_codigo"] in funds}
        local_expected = [r for r in diary if entry_key(r) in local_cash_entries]
        erp_balances = [r for r in erp_balances_all if r["nivel"] == "subcuenta"]
        financial = ("saldo_anterior","total_debe","total_haber","saldo_periodo","saldo_acumulado")
        report["cash_movimientos_vs_erp"] = compare(cash, erp_cash, movement_key, ("debe","haber"))
        report["cash_movimientos_vs_libro_local"] = compare(cash, local_expected, movement_key, ("debe","haber"))
        report["cash_saldos_vs_erp"] = compare([r for r in balances if r["cuenta_codigo"] in funds and r["empresa_id"] in (1,2,5)], erp_balances, balance_key, financial)
        report["mayor_local_vs_erp"] = compare([r for r in mayor if r["cuenta_codigo"] in funds],
            [r for r in erp_balances if r["periodo_anio"]>=2026],balance_key,financial)
        monthly_key = lambda r: (r["empresa_id"],r["periodo_anio"],r["periodo_mes"],r["cuenta_codigo"])
        erp_sub = grouped(erp_balances, monthly_key, financial)
        erp_account = grouped([r for r in erp_balances_all if r["nivel"]=="cuenta"], monthly_key, financial)
        erp_internal = []
        for key in set(erp_sub)|set(erp_account):
            for field in financial:
                a, b = erp_sub.get(key,{}).get(field,Decimal(0)), erp_account.get(key,{}).get(field,Decimal(0))
                if a != b:
                    erp_internal.append({"clave":key,"campo":field,"subcuentas":a,"cuenta":b})
        report["mayor_erp_cuenta_vs_subcuentas"] = {"diferencias":len(erp_internal),"detalle":erp_internal[:50]}
        months = {date(r["periodo_anio"],r["periodo_mes"],1) for r in cash}
        months.update(date(r["periodo_anio"],r["periodo_mes"],1) for r in erp_cash)
        report["conciliacion_interna"] = reconcile_cash(session, months)
        mappings = build_cash_mappings_by_key(session)
        subs = session.exec(select(ErpCashSubcta)).all()
        states = {(s.tpo_subcta,s.nro_subcta):s.estado for s in subs if s.deleted_at is None or s.estado=='bloqueada'}
        cats = {(s.tpo_subcta,s.nro_subcta):s.categoria for s in subs if s.deleted_at is None and s.estado=='activa'}
        mapping_errors=[]
        unassigned=Counter()
        for r in cash:
            try:
                sub = (int(r['tipo_subcuenta']),int(r['nro_subcuenta']))
            except (TypeError,ValueError):
                sub = None
            expected=resolve_cash_account_id(cuenta_codigo=r['cuenta_codigo'],
                side='debe' if r['debe'] else 'haber' if r['haber'] else None,
                subcuenta_key=sub,mappings_by_key=mappings,fondo_mappings_by_cuenta=funds,
                categories_by_subcuenta=cats,states_by_subcuenta=states)
            if r['cuenta_cash_id']!=expected:
                mapping_errors.append({'source_id':r['source_id'],'cuenta':r['cuenta_codigo'],
                    'estado':states.get(sub),'actual':r['cuenta_cash_id'],'esperado':expected})
            if r['cuenta_cash_id'] is None:
                reason='importe_cero' if r['debe']==r['haber']==0 else states.get(sub,'sin_estado')
                unassigned[reason]+=1
        report['mapeos']={'diferencias':len(mapping_errors),'detalle':mapping_errors[:50],
            'sin_cuenta_por_motivo':dict(unassigned)}
        report['duplicados_source_id_cash']=sum(n-1 for n in Counter(r['source_id'] for r in cash).values() if n>1)
        report['resumen_mensual']=[]
        for month in sorted(months):
            actual=[r for r in cash if (r['periodo_anio'],r['periodo_mes'])==(month.year,month.month)]
            expected=[r for r in erp_cash if (r['periodo_anio'],r['periodo_mes'])==(month.year,month.month)]
            report['resumen_mensual'].append({'periodo':month.strftime('%Y-%m'),
                'cash_renglones':len(actual),'erp_renglones_elegibles':len(expected),
                'cash_asientos':len({entry_key(r) for r in actual}),
                'erp_asientos_elegibles':len({entry_key(r) for r in expected}),
                'cash_debe':sum((r['debe'] for r in actual),Decimal(0)),
                'cash_haber':sum((r['haber'] for r in actual),Decimal(0))})
        counter_errors=[]
        for p in period_rows:
            month=p['fecha_periodo']
            if month not in months:
                continue
            n=sum((r['periodo_anio'],r['periodo_mes'])==(month.year,month.month) for r in cash)
            b=sum((r['periodo_anio'],r['periodo_mes'])==(month.year,month.month) for r in balances)
            if (n,b)!=(p['movimientos_count'],p['saldos_count']):
                counter_errors.append({'periodo':month,'movimientos_reales':n,'saldos_reales':b,
                    'movimientos_registrados':p['movimientos_count'],'saldos_registrados':p['saldos_count']})
        report['contadores_periodos']={'diferencias':len(counter_errors),'detalle':counter_errors}
        report['periodos']=period_rows
        report['fin_utc']=datetime.now(UTC)
        path=Path(__file__).resolve().parents[1]/'tmp'/('audit_cash_erp_'+datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')+'.json')
        path.write_text(json.dumps(report,default=str,indent=2),encoding='utf-8')
        session.rollback()
    summary={'reporte':str(path)}
    for key,value in report.items():
        if isinstance(value,dict):
            summary[key]={k:v for k,v in value.items() if not k.startswith('detalle')}
    summary['resumen_mensual']=report['resumen_mensual']
    print(json.dumps(summary,default=str,indent=2))


if __name__ == '__main__':
    main()
