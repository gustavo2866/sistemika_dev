from app.db import engine
from sqlalchemy import text
from datetime import date, timedelta

today = date(2026, 4, 22)
alert_days = 60
limite = today + timedelta(days=alert_days)

# Reproduce exactamente la query de _build_inmobiliaria_section en home_dashboard.py
SQL_HOME = """
    SELECT COUNT(c.id)
    FROM contratos c
    JOIN propiedades p ON p.id = c.propiedad_id
    JOIN propiedades_status ps ON ps.id = p.propiedad_status_id
    WHERE c.deleted_at IS NULL
      AND c.estado = 'vigente'
      AND p.deleted_at IS NULL
      AND ps.orden = 4
      AND c.fecha_renovacion IS NOT NULL
      AND c.fecha_renovacion >= :today
      AND c.fecha_renovacion < :limite
      AND (c.fecha_vencimiento IS NULL OR c.fecha_renovacion <= c.fecha_vencimiento)
"""

# Reproduce build_prop_selectors de propiedades_dashboard.py
SQL_PROPD = """
    SELECT COUNT(p.id)
    FROM propiedades p
    JOIN propiedades_status ps ON ps.id = p.propiedad_status_id
    WHERE p.deleted_at IS NULL
      AND ps.orden = 4
      AND p.fecha_renovacion IS NOT NULL
      AND p.fecha_renovacion >= :today
      AND p.fecha_renovacion < :limite
      AND (p.vencimiento_contrato IS NULL OR p.fecha_renovacion <= p.vencimiento_contrato)
"""

# Detalle de cuáles entran en cada query
SQL_HOME_DETAIL = """
    SELECT c.id AS cont_id, p.id AS prop_id, p.nombre,
           c.fecha_renovacion, c.fecha_vencimiento, ps.orden
    FROM contratos c
    JOIN propiedades p ON p.id = c.propiedad_id
    JOIN propiedades_status ps ON ps.id = p.propiedad_status_id
    WHERE c.deleted_at IS NULL
      AND c.estado = 'vigente'
      AND p.deleted_at IS NULL
      AND ps.orden = 4
      AND c.fecha_renovacion IS NOT NULL
      AND c.fecha_renovacion >= :today
      AND c.fecha_renovacion < :limite
      AND (c.fecha_vencimiento IS NULL OR c.fecha_renovacion <= c.fecha_vencimiento)
    ORDER BY p.id
"""

SQL_PROPD_DETAIL = """
    SELECT p.id AS prop_id, p.nombre,
           p.fecha_renovacion, p.vencimiento_contrato, ps.orden
    FROM propiedades p
    JOIN propiedades_status ps ON ps.id = p.propiedad_status_id
    WHERE p.deleted_at IS NULL
      AND ps.orden = 4
      AND p.fecha_renovacion IS NOT NULL
      AND p.fecha_renovacion >= :today
      AND p.fecha_renovacion < :limite
      AND (p.vencimiento_contrato IS NULL OR p.fecha_renovacion <= p.vencimiento_contrato)
    ORDER BY p.id
"""

with engine.connect() as conn:
    params = {"today": today, "limite": limite}

    cnt_home = conn.execute(text(SQL_HOME), params).scalar()
    cnt_propd = conn.execute(text(SQL_PROPD), params).scalar()
    print(f"home_dashboard  (Contrato): {cnt_home}")
    print(f"propiedades_dashboard (Propiedad): {cnt_propd}")

    print("\n--- home_dashboard detalle ---")
    for r in conn.execute(text(SQL_HOME_DETAIL), params).fetchall():
        print(f"  Prop {r.prop_id} [{r.nombre}]  cont={r.cont_id}  reno={r.fecha_renovacion}  venc={r.fecha_vencimiento}")

    print("\n--- propiedades_dashboard detalle ---")
    for r in conn.execute(text(SQL_PROPD_DETAIL), params).fetchall():
        print(f"  Prop {r.prop_id} [{r.nombre}]  reno={r.fecha_renovacion}  venc={r.vencimiento_contrato}")








