"""Medicion simple de tiempos de cada endpoint -- sin dependencias de terminal."""
import httpx
import time
import sys

BASE = "http://localhost:8000/api/dashboard/propiedades"
RUNS = 3

cases = [
    ("selectors/sin-filtro",       f"{BASE}/selectors",       {}),
    ("selectors/alquiler",         f"{BASE}/selectors",       {"tipoOperacionId": "1"}),
    ("bundle-Q1-2026/sin-filtro",  f"{BASE}/bundle",          {"startDate": "2026-01-01", "endDate": "2026-03-31", "periodType": "trimestre"}),
    ("bundle-Q1-2026/alquiler",    f"{BASE}/bundle",          {"startDate": "2026-01-01", "endDate": "2026-03-31", "periodType": "trimestre", "tipoOperacionId": "1"}),
    ("bundle-H2-2025/sin-filtro",  f"{BASE}/bundle",          {"startDate": "2025-07-01", "endDate": "2025-12-31", "periodType": "semestre"}),
    ("bundle-feb-2026/sin-filtro", f"{BASE}/bundle",          {"startDate": "2026-02-01", "endDate": "2026-02-28", "periodType": "mes"}),
    ("detalle-recibida",           f"{BASE}/detalle",         {"selectorKey": "recibida"}),
    ("detalle-disponible",         f"{BASE}/detalle",         {"selectorKey": "disponible"}),
    ("detalle-alerta-renovacion",  f"{BASE}/detalle-alerta",  {"alertKey": "renovacion_lt_60"}),
]

# warmup
for _, url, params in cases:
    httpx.get(url, params=params, timeout=30)

results = []
for label, url, params in cases:
    times = []
    err = None
    for _ in range(RUNS):
        t0 = time.perf_counter()
        try:
            r = httpx.get(url, params=params, timeout=30)
            ms = (time.perf_counter() - t0) * 1000
            if r.status_code == 200:
                times.append(ms)
            else:
                err = f"HTTP {r.status_code}"
        except Exception as e:
            err = str(e)[:60]
    if times:
        results.append((label, min(times), sum(times)/len(times), max(times), None))
    else:
        results.append((label, 0, 0, 0, err))

print()
print(f"{'Endpoint':<35} {'min':>8}  {'avg':>8}  {'max':>8}")
print("-" * 65)
for label, lo, avg, hi, err in results:
    if err:
        print(f"{label:<35}  ERROR: {err}")
    else:
        note = "  << LENTO" if avg > 400 else ""
        print(f"{label:<35} {lo:>7.0f}ms  {avg:>7.0f}ms  {hi:>7.0f}ms{note}")
print("-" * 65)
sys.exit(0)
