import requests
import json

BASE_URL = "http://localhost:8000"

print("=" * 80)
print("TEST: ENDPOINT DE ACTIVIDADES REFACTORIZADO")
print("=" * 80)
print()

# Casos de prueba
casos = [
    {
        "nombre": "Caso 1: Mensaje con oportunidad (ID 23)",
        "url": f"{BASE_URL}/crm/mensajes/23/actividades",
        "esperado": "Debería buscar por oportunidad #6520"
    },
    {
        "nombre": "Caso 2: Mensaje sin oportunidad pero con contacto (ID 24)",
        "url": f"{BASE_URL}/crm/mensajes/24/actividades",
        "esperado": "Debería buscar por contacto"
    },
    {
        "nombre": "Caso 3: Buscar directamente por oportunidad",
        "url": f"{BASE_URL}/crm/mensajes/query-actividades?oportunidad_id=6520",
        "esperado": "Todas las actividades de oportunidad #6520"
    },
    {
        "nombre": "Caso 4: Buscar directamente por contacto",
        "url": f"{BASE_URL}/crm/mensajes/query-actividades?contacto_id=42",
        "esperado": "Todas las actividades de contacto #42"
    },
    {
        "nombre": "Caso 5: Mensaje sin contacto (buscar por referencia)",
        "url": f"{BASE_URL}/crm/mensajes/query-actividades?mensaje_id=24",
        "esperado": "Mensajes con la misma referencia"
    }
]

for i, caso in enumerate(casos, 1):
    print(f"\n{'='*80}")
    print(f"TEST {i}: {caso['nombre']}")
    print(f"{'='*80}")
    print(f"URL: {caso['url']}")
    print(f"Esperado: {caso['esperado']}")
    print()
    
    try:
        response = requests.get(caso['url'])
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"✓ Status: 200 OK")
            print(f"✓ Criterio de búsqueda: {data.get('criterio')}")
            print(f"✓ Mensaje ID: {data.get('mensaje_id')}")
            print(f"✓ Contacto ID: {data.get('contacto_id')}")
            print(f"✓ Oportunidad ID: {data.get('oportunidad_id')}")
            if data.get('contacto_referencia'):
                print(f"✓ Referencia: {data.get('contacto_referencia')}")
            print(f"✓ Total actividades: {data.get('total')}")
            
            if data.get('actividades'):
                print(f"\nÚltimas 3 actividades:")
                for j, act in enumerate(data['actividades'][:3], 1):
                    tipo_icon = "📱" if act['tipo'] == 'mensaje' else "✓"
                    print(f"  {j}. {tipo_icon} {act['tipo'].upper()} #{act['id']}")
                    print(f"     {act['descripcion'][:60]}...")
            
        else:
            print(f"✗ Error: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"✗ Excepción: {str(e)}")

print()
print("=" * 80)
print("RESUMEN DE FUNCIONALIDAD")
print("=" * 80)
print()
print("El endpoint ahora soporta:")
print("  1. /crm/mensajes/{id}/actividades - Ruta legacy compatible")
print("  2. /crm/mensajes/query-actividades?mensaje_id=X")
print("  3. /crm/mensajes/query-actividades?contacto_id=X")
print("  4. /crm/mensajes/query-actividades?oportunidad_id=X")
print("  5. Combinaciones de parámetros")
print()
print("Lógica de búsqueda:")
print("  • Si hay oportunidad → busca por oportunidad (más específico)")
print("  • Si no hay oportunidad pero hay contacto → busca por contacto")
print("  • Si solo hay mensaje → busca por referencia del contacto")
print()
print("Retorna:")
print("  • criterio: 'oportunidad' | 'contacto' | 'referencia'")
print("  • mensaje_id, contacto_id, oportunidad_id")
print("  • total: cantidad de actividades")
print("  • actividades[]: lista combinada de mensajes y eventos")
print()
