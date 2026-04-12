"""
Compara tiempos HTTP reales entre CRM dashboard y Prop dashboard.
Correr con el server uvicorn activo.
"""
import time
import statistics
import httpx

BASE = "http://127.0.0.1:8000/api/dashboard"
HOST = "http://127.0.0.1:8000"
RUNS = 5

cases = [
    # Baseline sin DB
    ("BASELINE /health",          f"{HOST}/health",  {}),
    # CRM dashboard
    ("CRM /selectors",            f"{BASE}/crm/selectors", {}),
    ("CRM /bundle Q1-2026",       f"{BASE}/crm/bundle",    {"startDate": "2026-01-01", "endDate": "2026-03-31", "periodType": "trimestre"}),
    # Prop dashboard
    ("PROP /selectors",           f"{BASE}/propiedades/selectors", {}),
    ("PROP /bundle Q1-2026",      f"{BASE}/propiedades/bundle",    {"startDate": "2026-01-01", "endDate": "2026-03-31", "periodType": "trimestre"}),
    ("PROP /detalle disponible",  f"{BASE}/propiedades/detalle",   {"selectorKey": "disponible"}),
]

# Primera pasada para calentar pool
print("Calentando conexiones DB...")
for _, url, params in cases:
    try:
        httpx.get(url, params=params, timeout=15)
    except Exception:
        pass

print(f"\n{'Endpoint':<30} {'min':>6}  {'avg':>6}  {'max':>6}  {'status'}")
print("-" * 65)

for label, url, params in cases:
    times = []
    status = "OK"
    for _ in range(RUNS):
        try:
            t0 = time.perf_counter()
            r = httpx.get(url, params=params, timeout=15)
            ms = (time.perf_counter() - t0) * 1000
            times.append(ms)
            if r.status_code != 200:
                status = f"HTTP {r.status_code}"
        except Exception as e:
            times.append(9999)
            status = str(e)[:30]
    lo = min(times)
    avg = statistics.mean(times)
    hi = max(times)
    slow = "  << LENTO" if avg > 500 else ""
    print(f"{label:<30} {lo:>5.0f}ms  {avg:>5.0f}ms  {hi:>5.0f}ms  {status}{slow}")
