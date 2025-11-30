import requests
import json

BASE_URL = "http://localhost:8000"

# Usar el mensaje ID 23 que ya tiene oportunidad asociada
mensaje_id = 23

print("=" * 70)
print(f"OBTENIENDO ACTIVIDADES DEL MENSAJE #{mensaje_id}")
print("=" * 70)
print()

try:
    response = requests.get(f"{BASE_URL}/crm/mensajes/{mensaje_id}/actividades")
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"✓ Mensaje ID: {data['mensaje_id']}")
        print(f"✓ Oportunidad ID: {data['oportunidad_id']}")
        print(f"✓ Total de Actividades: {data['total']}")
        print()
        
        if data['actividades']:
            print("=" * 70)
            print("LISTA DE ACTIVIDADES")
            print("=" * 70)
            print()
            
            for i, actividad in enumerate(data['actividades'], 1):
                print(f"{i}. {actividad['tipo'].upper()} - ID: {actividad['id']}")
                print(f"   Fecha: {actividad['fecha']}")
                print(f"   Descripción: {actividad['descripcion']}")
                
                if actividad['tipo'] == 'mensaje':
                    print(f"   Canal: {actividad['canal']}")
                    print(f"   Estado: {actividad['estado']}")
                    print(f"   Tipo: {actividad['tipo_mensaje']}")
                elif actividad['tipo'] == 'evento':
                    print(f"   Estado: {actividad['estado']}")
                    print(f"   Tipo ID: {actividad['tipo_id']}")
                    print(f"   Motivo ID: {actividad['motivo_id']}")
                
                print()
        else:
            print("No hay actividades registradas para esta oportunidad.")
            
    else:
        print(f"✗ Error: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"✗ Error: {str(e)}")

print()
print("=" * 70)
print("URL del endpoint:")
print(f"{BASE_URL}/crm/mensajes/{mensaje_id}/actividades")
print("=" * 70)
