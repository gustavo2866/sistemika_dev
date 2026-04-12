"""Test rápido de endpoints de contratos."""
import requests

BASE = "http://localhost:8000"

# Obtener una propiedad real
r = requests.get(f"{BASE}/propiedades?_start=0&_end=1")
props = r.json()
prop_id = props[0]["id"] if isinstance(props, list) and props else None
print(f"prop_id disponible: {prop_id}")

payload = {
    "propiedad_id": prop_id,
    "tipo_contrato_id": 1,
    "fecha_inicio": "2026-04-01",
    "fecha_vencimiento": "2029-03-31",
    "valor_alquiler": 150000.0,
    "moneda": "ARS",
    "inquilino_nombre": "Juan",
    "inquilino_apellido": "Perez",
    "estado": "borrador",
}

# --- Crear borrador ---
r = requests.post(f"{BASE}/contratos", json=payload)
print(f"POST /contratos: {r.status_code}", r.text[:200] if not r.ok else f"id={r.json().get('id')}")
c_id = r.json().get("id") if r.ok else None

if c_id:
    # --- GET ---
    r = requests.get(f"{BASE}/contratos/{c_id}")
    print(f"GET /contratos/{c_id}: {r.status_code} estado={r.json().get('estado')}")

    # --- Activar ---
    r = requests.post(f"{BASE}/contratos/{c_id}/activar")
    print(f"POST /activar: {r.status_code}", r.json().get("estado") if r.ok else r.text[:200])

    # --- Rescindir ---
    r = requests.post(f"{BASE}/contratos/{c_id}/rescindir", json={"fecha_rescision": "2026-04-11", "motivo_rescision": "Test"})
    print(f"POST /rescindir: {r.status_code}", r.json().get("estado") if r.ok else r.text[:200])

# --- Nuevo contrato para probar renovar ---
payload["inquilino_nombre"] = "Maria"
r = requests.post(f"{BASE}/contratos", json=payload)
c2_id = r.json().get("id") if r.ok else None
print(f"POST /contratos (c2): {r.status_code} id={c2_id}")

if c2_id:
    requests.post(f"{BASE}/contratos/{c2_id}/activar")
    r = requests.post(f"{BASE}/contratos/{c2_id}/renovar")
    if r.ok:
        d = r.json()
        print(f"POST /renovar: {r.status_code} original={d.get('contrato_original_id')} nuevo={d.get('nuevo_contrato_id')}")
    else:
        print(f"POST /renovar: {r.status_code}", r.text[:200])

    # Intentar activar el contrato "renovado" -> debe dar error 400
    r = requests.post(f"{BASE}/contratos/{c2_id}/activar")
    print(f"activar 'renovado' (esperado 400): {r.status_code}", r.json().get("detail") if not r.ok else "SIN ERROR - FALLO")

# --- Filtro por estado ---
r = requests.get(f"{BASE}/contratos?estado=borrador")
count = len(r.json()) if isinstance(r.json(), list) else "?"
print(f"GET /contratos?estado=borrador: {r.status_code} count={count}")
