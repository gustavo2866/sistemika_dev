"""Read-only consistency audit after Cash reconstruction; prints aggregate JSON."""
import json
import sys
from pathlib import Path
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import text
from sqlmodel import Session, select
from app.db import engine
from app.models.erp.cash_diario import ErpCashDiario
from app.models.erp.cash_subcta import ErpCashSubcta
from app.models.erp.cash_periodo import ErpCashPeriodo
from app.models.erp.cash_cuenta import ErpCashCuenta
from app.models.erp.cash_proyectado import ErpCashProyectado
from app.models.erp.cash_pendientes_input import ErpCashPendientesInput
from app.models.metodo_proyeccion import MetodoProyeccion
from app.models.erp.cash_diario_sync import _subcuenta_key, _has_value
from app.services.erp_cash_mapping_service import (
    build_cash_mappings_by_key, get_fondo_mappings_by_cuenta, resolve_cash_account_id,
)
from app.services.cash_projection_horizon import get_projection_horizon
from app.services.cash_projection_service import CashProjectionEngine
from app.services.erp_cash_pendientes_projection_service import _parse_date, _parse_decimal, _parse_int

report = {}
with Session(engine) as session:
    session.exec(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'))
    session.exec(text("SET LOCAL statement_timeout = '60s'"))
    report['snapshot_utc'] = session.exec(text('SELECT now()')).scalar()
    horizon = get_projection_horizon(session)
    report['horizon'] = horizon.as_dict()
    periods = session.exec(select(ErpCashPeriodo).where(ErpCashPeriodo.deleted_at.is_(None)).order_by(ErpCashPeriodo.fecha_periodo)).all()
    report['periods'] = [dict(month=p.fecha_periodo, state=p.estado, closed_at=p.cerrado_en,
        sync=p.ultima_sincronizacion, count=p.movimientos_count, balances=p.saldos_count) for p in periods]
    mappings = build_cash_mappings_by_key(session)
    funds = get_fondo_mappings_by_cuenta(session)
    subs = session.exec(select(ErpCashSubcta).order_by(ErpCashSubcta.id)).all()
    states = {(s.tpo_subcta,s.nro_subcta):s.estado for s in subs if s.deleted_at is None or s.estado=='bloqueada'}
    categories = {(s.tpo_subcta,s.nro_subcta):s.categoria for s in subs if s.deleted_at is None and s.estado=='activa'}
    accounts = {a.id:a for a in session.exec(select(ErpCashCuenta)).all()}
    movements = session.exec(select(ErpCashDiario).where(ErpCashDiario.deleted_at.is_(None),
        ErpCashDiario.periodo_anio>=2026)).all()
    mismatches=[]
    unmapped=Counter()
    blocked=0
    orphaned=[]
    for row in movements:
        key=_subcuenta_key(row)
        if row.cuenta_cash_id is not None and (row.cuenta_cash_id not in accounts or accounts[row.cuenta_cash_id].deleted_at is not None):
            orphaned.append(row.source_id)
        if states.get(key)=='bloqueada':
            blocked+=1
        expected=resolve_cash_account_id(cuenta_codigo=row.cuenta_codigo,
            side='debe' if _has_value(row.debe) else 'haber' if _has_value(row.haber) else None,
            subcuenta_key=key,mappings_by_key=mappings,fondo_mappings_by_cuenta=funds,
            categories_by_subcuenta=categories,states_by_subcuenta=states)
        if row.cuenta_cash_id!=expected:
            mismatches.append(dict(source=row.source_id,month=f'{row.periodo_anio}-{row.periodo_mes:02}',
                account=row.cuenta_codigo,sub=key,actual=row.cuenta_cash_id,expected=expected))
        if row.cuenta_cash_id is None:
            reason='subcuenta_error' if states.get(key)=='error' and row.cuenta_codigo not in funds else 'sin_destino_en_mapeo_vigente'
            unmapped[reason]+=1
    report['mapping'] = dict(examined=len(movements),blocked_checked=blocked,mismatches=len(mismatches),
        examples=mismatches[:15],unmapped=dict(unmapped),orphaned_accounts=len(orphaned))
    target=[r for r in movements if r.cuenta_codigo==3866 and r.periodo_anio==2026 and r.periodo_mes==9]
    report['case_3866_sep'] = [dict(source=r.source_id,sub=_subcuenta_key(r),amount=-(r.debe+r.haber),cash=r.cuenta_cash_id) for r in target]
    sql_checks={
        'duplicate_diary_sources': 'SELECT count(*) FROM (SELECT source_id FROM erp_cash_diarios WHERE deleted_at IS NULL GROUP BY source_id HAVING count(*)>1) t',
        'duplicate_balance_sources': 'SELECT count(*) FROM (SELECT source_id FROM erp_cash_saldos WHERE deleted_at IS NULL GROUP BY source_id HAVING count(*)>1) t',
        'duplicate_projection_keys': 'SELECT count(*) FROM (SELECT cuenta_cash_id,fecha_periodo FROM erp_cash_proyectado WHERE deleted_at IS NULL GROUP BY 1,2 HAVING count(*)>1) t',
        'projection_total_mismatch': "SELECT count(*) FROM erp_cash_proyectado WHERE deleted_at IS NULL AND total_proyectado IS DISTINCT FROM (CASE WHEN tipo_calculo='PENDIENTE' THEN importe_pendiente ELSE importe_proyectado END+importe_comprometido)",
        'diary_source_amount_mismatch': 'SELECT count(*) FROM erp_cash_diarios c JOIN erp_libro_diario l USING(source_id) WHERE c.deleted_at IS NULL AND l.deleted_at IS NULL AND c.periodo_anio>=2026 AND (c.debe,c.haber,c.fecha,c.empresa_id,c.cuenta_codigo) IS DISTINCT FROM (l.debe,l.haber,l.fecha,l.empresa_id,l.cuenta_codigo)',
        'diary_source_missing': 'SELECT count(*) FROM erp_cash_diarios c LEFT JOIN erp_libro_diario l ON l.source_id=c.source_id AND l.deleted_at IS NULL WHERE c.deleted_at IS NULL AND c.periodo_anio>=2026 AND l.id IS NULL',
        'balance_source_amount_mismatch': 'SELECT count(*) FROM erp_cash_saldos c JOIN erp_libro_mayor l USING(source_id) WHERE c.deleted_at IS NULL AND l.deleted_at IS NULL AND c.periodo_anio>=2026 AND (c.total_debe,c.total_haber,c.saldo_anterior,c.saldo_periodo,c.saldo_acumulado) IS DISTINCT FROM (l.total_debe,l.total_haber,l.saldo_anterior,l.saldo_periodo,l.saldo_acumulado)',
        'period_diary_counter_mismatch': 'SELECT count(*) FROM erp_cash_periodos p WHERE p.deleted_at IS NULL AND p.fecha_periodo>=\'2026-01-01\' AND p.movimientos_count<>(SELECT count(*) FROM erp_cash_diarios c WHERE c.deleted_at IS NULL AND c.periodo_anio=extract(year from p.fecha_periodo) AND c.periodo_mes=extract(month from p.fecha_periodo))',
        'period_balance_counter_mismatch': 'SELECT count(*) FROM erp_cash_periodos p WHERE p.deleted_at IS NULL AND p.fecha_periodo>=\'2026-01-01\' AND p.saldos_count<>(SELECT count(*) FROM erp_cash_saldos c WHERE c.deleted_at IS NULL AND c.periodo_anio=extract(year from p.fecha_periodo) AND c.periodo_mes=extract(month from p.fecha_periodo))',
    }
    report['sql_checks']={name:session.exec(text(query)).scalar() for name,query in sql_checks.items()}
    projections=session.exec(select(ErpCashProyectado).where(ErpCashProyectado.deleted_at.is_(None),
        ErpCashProyectado.fecha_periodo>=date(2026,1,1),ErpCashProyectado.fecha_periodo<=horizon.end)).all()
    methods={m.id:m for m in session.exec(select(MetodoProyeccion)).all()}
    calc_engine=CashProjectionEngine(session)
    projection_errors=[]
    method_errors=[]
    calculated=0
    for row in sorted(projections,key=lambda r:(r.fecha_periodo,r.cuenta_cash_id)):
        account=accounts[row.cuenta_cash_id]
        if account.deleted_at is not None or account.tipo.strip().upper() not in {'INGRESO','EGRESO'}:
            continue
        method=methods.get(account.id_metodo_proyeccion)
        kind=method.tipo_calculo if method else 'HISTORICO'
        if (row.id_metodo_proyeccion,row.tipo_calculo)!=(account.id_metodo_proyeccion,kind):
            method_errors.append(row.id)
        if row.origen_proyectado=='CALCULADO' and method and kind!='PENDIENTE':
            try:
                expected=calc_engine.calculate(account.id,row.fecha_periodo).projected_value.quantize(Decimal('0.01'))
                calculated+=1
                if expected!=row.importe_proyectado:
                    projection_errors.append(dict(account=account.id,month=row.fecha_periodo,actual=row.importe_proyectado,expected=expected))
            except Exception as exc:
                projection_errors.append(dict(account=account.id,month=row.fecha_periodo,error=str(exc)))
    report['projections']=dict(rows=len(projections),recalculated_readonly=calculated,method_mismatch=len(method_errors),
        value_mismatch=len(projection_errors),examples=projection_errors[:15],manual_rows=sum(r.origen_proyectado=='MANUAL' for r in projections))
    totals=defaultdict(Decimal)
    for item in session.exec(select(ErpCashPendientesInput).where(ErpCashPendientesInput.deleted_at.is_(None))).all():
        if states.get((_parse_int(item.tipsub_raw),_parse_int(item.nrosub_raw)))=='bloqueada' or item.cuenta_cash_id is None or not item.is_valid:
            continue
        due,amount=_parse_date(item.fecvenc_raw),_parse_decimal(item.saldo_raw)
        if due is None or amount is None:
            continue
        month=max(date(due.year,due.month,1),horizon.start)
        if month<=horizon.end and not any(p.fecha_periodo==month and p.estado=='CERRADO' for p in periods):
            totals[(item.cuenta_cash_id,month)]+=amount
    stored={(r.cuenta_cash_id,r.fecha_periodo):r.importe_pendiente for r in projections if r.fecha_periodo>=horizon.start and not any(p.fecha_periodo==r.fecha_periodo and p.estado=='CERRADO' for p in periods)}
    pending_errors=[dict(account=k[0],month=k[1],actual=stored.get(k,0),expected=totals.get(k,Decimal(0)).quantize(Decimal('.01')))
        for k in set(stored)|set(totals) if stored.get(k,0)!=totals.get(k,Decimal(0)).quantize(Decimal('.01'))]
    report['pending_totals']=dict(keys=len(set(stored)|set(totals)),mismatches=len(pending_errors),examples=pending_errors[:15])
    from app.services.erp_cash_reconciliation_service import reconcile_cash
    report['reconciliation'] = reconcile_cash(session, {
        p.fecha_periodo for p in periods if date(2026,1,1) <= p.fecha_periodo <= horizon.end
        and (p.movimientos_count or p.saldos_count)
    })
    session.rollback()
print(json.dumps(report,default=str,indent=2))
