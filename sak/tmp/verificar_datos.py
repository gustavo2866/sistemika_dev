import requests
import json

# Verificar Oportunidad
r = requests.get('http://localhost:8000/crm/oportunidades/6520')
data = r.json()
print("=" * 60)
print("OPORTUNIDAD #6520")
print("=" * 60)
print(f"ID: {data['id']}")
print(f"Tipo Operación ID: {data.get('tipo_operacion_id')}")
print(f"Fecha Estado: {data.get('fecha_estado')}")
print(f"Estado: {data.get('estado')}")
print(f"Descripción Estado: {data.get('descripcion_estado')}")
print(f"Contacto ID: {data.get('contacto_id')}")
print(f"Responsable ID: {data.get('responsable_id')}")

# Verificar Evento
print("\n" + "=" * 60)
print("EVENTO #220")
print("=" * 60)
r2 = requests.get('http://localhost:8000/crm/eventos/220')
ev = r2.json()
print(f"ID: {ev['id']}")
print(f"Estado Evento: {ev.get('estado_evento')}")
print(f"Fecha Evento: {ev.get('fecha_evento')}")
print(f"Descripción: {ev.get('descripcion')}")
print(f"Oportunidad ID: {ev.get('oportunidad_id')}")
print(f"Contacto ID: {ev.get('contacto_id')}")
