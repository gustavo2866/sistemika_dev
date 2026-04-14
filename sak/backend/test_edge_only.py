"""Test de edge cases seccion 7 de forma aislada."""
import httpx

BASE = "http://localhost:8000/api/dashboard/propiedades"


def get(path, **params):
    url = f"{BASE}{path}"
    r = httpx.get(url, params=params, timeout=20)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:400]}")
    return r.json()


print("--- Test 1: periodo antiguo ---")
try:
    data = get("/bundle", startDate="2010-01-01", endDate="2010-03-31", periodType="trimestre")
    v = data["current"]["kpis"]["vacancias_periodo"]["count"]
    print(f"OK: count={v}")
except Exception as e:
    print(f"FAIL: {e}")

print("--- Test 2: periodo futuro ---")
try:
    data2 = get("/bundle", startDate="2030-01-01", endDate="2030-03-31", periodType="trimestre")
    print("OK")
except Exception as e:
    print(f"FAIL: {e}")

print("--- Test 3: selectorKey invalido ---")
try:
    d = get("/detalle", selectorKey="inexistente", pageSize=10)
    t = d.get("total")
    print(f"OK: total={t}, data_len={len(d.get('data', []))}")
except Exception as e:
    print(f"FAIL: {e}")

print("--- Test 4: alertKey invalido ---")
try:
    d = get("/detalle-alerta", alertKey="inexistente", pageSize=10)
    t = d.get("total")
    print(f"OK: total={t}")
except Exception as e:
    print(f"FAIL: {e}")

print("--- Test 5: page fuera de rango ---")
try:
    d = get("/detalle", selectorKey="disponible", page=9999, pageSize=10)
    print(f"OK: data_len={len(d['data'])}, total={d['total']}")
except Exception as e:
    print(f"FAIL: {e}")

print("Done.")
