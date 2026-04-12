"""Mide tiempo puro de queries SQL directas (sin HTTP, sin service logic)."""
import sys, os, time
sys.path.insert(0, r"C:\Users\gpalmieri\source\sistemika\sak\backend")
os.chdir(r"C:\Users\gpalmieri\source\sistemika\sak\backend")

from app.db import get_session, engine
from sqlmodel import select, Session
from sqlalchemy import text

def t(label, fn, runs=3):
    times = []
    for _ in range(runs):
        with next(get_session()) as s:
            t0 = time.perf_counter()
            fn(s)
            times.append((time.perf_counter() - t0) * 1000)
    avg = sum(times) / len(times)
    print(f"  {label:<40} avg={avg:.0f}ms   times={[round(x) for x in times]}")

print("\n--- Query directas ---")
t("SELECT 1 (pre-ping baseline)",              lambda s: s.exec(text("SELECT 1")).all())
t("SELECT 1 again (misma conexion)",           lambda s: s.exec(text("SELECT 1")).all())
t("COUNT propiedades",                         lambda s: s.exec(text("SELECT COUNT(*) FROM propiedades WHERE deleted_at IS NULL")).all())
t("SELECT propiedades + status join",          lambda s: s.exec(text("SELECT p.id, ps.nombre FROM propiedades p LEFT JOIN propiedades_status ps ON p.propiedad_status_id = ps.id WHERE p.deleted_at IS NULL")).all())
t("COUNT PropiedadesLogStatus",                lambda s: s.exec(text("SELECT COUNT(*) FROM propiedades_log_status")).all())
t("SELECT logs por estado (fecha filter)",     lambda s: s.exec(text("SELECT DISTINCT propiedad_id FROM propiedades_log_status WHERE estado_nuevo_id = 4 AND DATE(fecha_cambio) BETWEEN '2026-01-01' AND '2026-03-31'")).all())

print("\n--- Comparacion pool_pre_ping overhead ---")
# Medir solo el pre-ping
t0 = time.perf_counter()
conn = engine.connect()
conn.close()
print(f"  engine.connect() + close          {(time.perf_counter()-t0)*1000:.0f}ms")

print()
