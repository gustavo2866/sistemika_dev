"""
Benchmark simple — corre DENTRO del proceso FastAPI para medir tiempo puro de servicio
sin overhead de red ni HTTP.
"""
import sys
import os
import time
import statistics

sys.path.insert(0, os.path.dirname(__file__))

from app.db import get_session
from app.services.propiedades_dashboard import (
    build_prop_dashboard_bundle,
    build_prop_selectors,
    build_prop_detalle,
    build_prop_detalle_alerta,
)

RUNS = 3

cases = [
    ("selectors / sin filtro",          lambda s: build_prop_selectors(s)),
    ("selectors / alquiler",            lambda s: build_prop_selectors(s, tipo_operacion_id=1)),
    ("bundle Q1-2026 / sin filtro",     lambda s: build_prop_dashboard_bundle(s, "2026-01-01", "2026-03-31", period_type="trimestre")),
    ("bundle Q1-2026 / alquiler",       lambda s: build_prop_dashboard_bundle(s, "2026-01-01", "2026-03-31", tipo_operacion_id=1, period_type="trimestre")),
    ("bundle H2-2025 / sin filtro",     lambda s: build_prop_dashboard_bundle(s, "2025-07-01", "2025-12-31", period_type="semestre")),
    ("bundle feb-2026 / sin filtro",    lambda s: build_prop_dashboard_bundle(s, "2026-02-01", "2026-02-28", period_type="mes")),
    ("detalle recibida",                lambda s: build_prop_detalle(s, "recibida")),
    ("detalle disponible",              lambda s: build_prop_detalle(s, "disponible")),
    ("detalle-alerta renovacion_lt_60", lambda s: build_prop_detalle_alerta(s, "renovacion_lt_60")),
]

print(f"\n{'Caso':<42} {'min':>7}  {'avg':>7}  {'max':>7}")
print("-" * 65)

for label, fn in cases:
    times = []
    for _ in range(RUNS):
        with next(get_session()) as session:
            t0 = time.perf_counter()
            fn(session)
            times.append((time.perf_counter() - t0) * 1000)
    lo, avg, hi = min(times), statistics.mean(times), max(times)
    note = "  << LENTO" if avg > 500 else ""
    print(f"{label:<42} {lo:>6.0f}ms  {avg:>6.0f}ms  {hi:>6.0f}ms{note}")

print("-" * 65)
print("(Tiempos son solo servicio Python+DB, sin overhead HTTP/red local)")
