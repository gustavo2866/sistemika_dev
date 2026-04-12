"""Benchmark de tiempos de respuesta de los endpoints del prop-dashboard."""
import httpx
import time
import statistics

BASE = "http://localhost:8000/api/dashboard/propiedades"

TESTS = [
    ("GET /selectors (sin filtro)",        "/selectors", {}),
    ("GET /selectors (alquiler)",           "/selectors", {"tipoOperacionId": "1"}),
    ("GET /selectors (venta)",              "/selectors", {"tipoOperacionId": "2"}),
    ("GET /bundle Q1-2026 sin filtro",      "/bundle",    {"startDate": "2026-01-01", "endDate": "2026-03-31", "periodType": "trimestre"}),
    ("GET /bundle Q1-2026 alquiler",        "/bundle",    {"startDate": "2026-01-01", "endDate": "2026-03-31", "periodType": "trimestre", "tipoOperacionId": "1"}),
    ("GET /bundle H2-2025 sin filtro",      "/bundle",    {"startDate": "2025-07-01", "endDate": "2025-12-31", "periodType": "semestre"}),
    ("GET /bundle feb-2026 sin filtro",     "/bundle",    {"startDate": "2026-02-01", "endDate": "2026-02-28", "periodType": "mes"}),
    ("GET /detalle recibida",               "/detalle",   {"selectorKey": "recibida",      "pageSize": 15}),
    ("GET /detalle disponible",             "/detalle",   {"selectorKey": "disponible",    "pageSize": 15}),
    ("GET /detalle realizada",              "/detalle",   {"selectorKey": "realizada",     "pageSize": 15}),
    ("GET /detalle retirada",               "/detalle",   {"selectorKey": "retirada",      "pageSize": 15}),
    ("GET /detalle-alerta renovacion",      "/detalle-alerta", {"alertKey": "renovacion_lt_60", "pageSize": 15}),
    ("GET /detalle-alerta vencimiento",     "/detalle-alerta", {"alertKey": "vencimiento_lt_60","pageSize": 15}),
]

WARMUP = 1
RUNS   = 5

print("Calentando...")
for _, path, params in TESTS:
    httpx.get(f"{BASE}{path}", params=params, timeout=20)

print(f"\n{'Endpoint':<45} {'min':>7} {'avg':>7} {'max':>7}  Status")
print("-" * 75)

totals = []
for label, path, params in TESTS:
    times = []
    status = "OK"
    for _ in range(RUNS):
        t0 = time.perf_counter()
        r = httpx.get(f"{BASE}{path}", params=params, timeout=20)
        ms = (time.perf_counter() - t0) * 1000
        times.append(ms)
        if r.status_code != 200:
            status = f"HTTP {r.status_code}"
    lo  = min(times)
    avg = statistics.mean(times)
    hi  = max(times)
    totals.append(avg)
    flag = "  <-- LENTO" if avg > 300 else ""
    print(f"{label:<45} {lo:>6.0f}ms {avg:>6.0f}ms {hi:>6.0f}ms  {status}{flag}")

print("-" * 75)
print(f"{'Promedio global':<45} {'':>7} {statistics.mean(totals):>6.0f}ms")
print(f"{'Máximo (worst case)':<45} {'':>7} {max(totals):>6.0f}ms")
