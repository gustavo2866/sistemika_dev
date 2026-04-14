"""
Test end-to-end: creacion de contrato con tipo_contrato, activar, renovar, rescindir.
"""
import requests, json

BASE = "http://localhost:8000"


def pp(label, r):
    try:
        data = r.json()
    except Exception:
        data = r.text[:300]
    body = json.dumps(data, default=str, ensure_ascii=False, indent=2)[:500]
    print(f"{label} [{r.status_code}]\n{body}\n")
    return data if r.ok else None


# 1. Tipo contrato existente
r = requests.get(BASE + "/tipos-contrato")
tipos = r.json() if r.ok else []
if not tipos:
    r = requests.post(BASE + "/tipos-contrato", json={"nombre": "Alquiler Residencial", "activo": True})
    tipos = [r.json()]
tc = tipos[0]
print(f"Usando tipo_contrato: id={tc['id']} nombre={tc['nombre']}\n")

# 2. Crear contrato borrador
payload = {
    "propiedad_id": 3,
    "tipo_contrato_id": tc["id"],
    "fecha_inicio": "2026-05-01",
    "fecha_vencimiento": "2029-04-30",
    "valor_alquiler": 250000,
    "moneda": "ARS",
    "inquilino_nombre": "Roberto",
    "inquilino_apellido": "Fernandez",
    "inquilino_dni": "25111222",
    "garante1_nombre": "Lucia",
    "garante1_apellido": "Gomez",
    "estado": "borrador",
}
r = requests.post(BASE + "/contratos", json=payload)
data = pp("POST /contratos (borrador)", r)
if not data:
    exit(1)
c_id = data["id"]

# 3. GET con relaciones
r = requests.get(BASE + f"/contratos/{c_id}")
data = pp(f"GET /contratos/{c_id}", r)
print(f"  tipo_contrato relacionado: {data.get('tipo_contrato')}")
print(f"  propiedad relacionada: {data.get('propiedad')}")
print()

# 4. Activar
r = requests.post(BASE + f"/contratos/{c_id}/activar")
data = pp(f"POST /contratos/{c_id}/activar", r)
if data:
    print(f"  => estado: {data.get('estado')}")
print()

# 5. Activar de nuevo (debe fallar 400)
r2 = requests.post(BASE + f"/contratos/{c_id}/activar")
print(f"POST /activar 2da vez [{r2.status_code}] (esperado 400): {r2.json().get('detail')}\n")

# 6. Renovar
r = requests.post(BASE + f"/contratos/{c_id}/renovar")
data = pp(f"POST /contratos/{c_id}/renovar", r)
if data:
    nuevo_id = data.get("nuevo_contrato_id")
    print(f"  contrato_original_id: {data.get('contrato_original_id')}")
    print(f"  nuevo_contrato_id:    {nuevo_id}")
    print()
    if nuevo_id:
        r3 = requests.get(BASE + f"/contratos/{nuevo_id}")
        d3 = r3.json()
        print("=== Nuevo contrato generado ===")
        for k in ["id", "estado", "tipo_contrato_id", "tipo_contrato", "propiedad_id", "propiedad",
                  "inquilino_nombre", "inquilino_apellido", "fecha_inicio", "fecha_vencimiento",
                  "valor_alquiler", "moneda", "garante1_nombre", "garante1_apellido"]:
            print(f"  {k}: {d3.get(k)}")
        print(f"  archivos: {len(d3.get('archivos', []))}")
        print()

    # Estado del original
    r_orig = requests.get(BASE + f"/contratos/{c_id}")
    print(f"Estado contrato original ({c_id}): {r_orig.json().get('estado')}")
    print()

# 7. Rescindir (usar el nuevo contrato si existe, activarlo primero)
if data and nuevo_id:
    requests.post(BASE + f"/contratos/{nuevo_id}/activar")
    r = requests.post(BASE + f"/contratos/{nuevo_id}/rescindir",
                      json={"fecha_rescision": "2026-04-12", "motivo_rescision": "Test de rescision"})
    dd = pp(f"POST /contratos/{nuevo_id}/rescindir", r)
    if dd:
        print(f"  => estado: {dd.get('estado')}")
        print(f"  => fecha_rescision: {dd.get('fecha_rescision')}")
        print(f"  => motivo_rescision: {dd.get('motivo_rescision')}")
