"""
Script para verificar el estado de un mensaje específico
"""
import requests
import sys

BASE_URL = "http://localhost:8000"

def verificar_mensaje(mensaje_id):
    response = requests.get(f"{BASE_URL}/crm/mensajes/{mensaje_id}")
    if response.status_code == 200:
        mensaje = response.json()
        print(f"\n{'='*60}")
        print(f"MENSAJE ID: {mensaje_id}")
        print(f"{'='*60}")
        print(f"Tipo: {mensaje.get('tipo')}")
        print(f"Estado: {mensaje.get('estado')}")
        print(f"Canal: {mensaje.get('canal')}")
        print(f"Asunto: {mensaje.get('asunto')}")
        print(f"Contenido: {mensaje.get('contenido', '')[:100]}...")
        print(f"\nContacto ID: {mensaje.get('contacto_id')}")
        print(f"Oportunidad ID: {mensaje.get('oportunidad_id')}")
        print(f"Responsable ID: {mensaje.get('responsable_id')}")
        print(f"Contacto Referencia: {mensaje.get('contacto_referencia')}")
        print(f"{'='*60}\n")
        
        if not mensaje.get('responsable_id'):
            print("⚠️  PROBLEMA: El mensaje NO tiene responsable_id asignado")
            print("   Esto causará error al intentar crear un contacto\n")
        else:
            print(f"✓ El mensaje tiene responsable_id: {mensaje.get('responsable_id')}\n")
        
        return mensaje
    else:
        print(f"Error: No se pudo obtener el mensaje {mensaje_id}")
        print(f"Status: {response.status_code}")
        print(response.text)
        return None

if __name__ == "__main__":
    # Obtener los últimos mensajes de entrada en estado nuevo
    response = requests.get(f"{BASE_URL}/crm/mensajes", params={
        "filter": '{"tipo":["entrada"],"estado":["nuevo"]}',
        "sort": '["id","DESC"]',
        "range": '[0,4]'
    })
    
    if response.status_code == 200:
        mensajes = response.json()
        print(f"\n📨 Últimos {len(mensajes)} mensajes de entrada en estado 'nuevo':\n")
        for msg in mensajes:
            print(f"  ID: {msg['id']} | Asunto: {msg.get('asunto', 'Sin asunto')[:40]} | Responsable: {msg.get('responsable_id')}")
        
        if mensajes:
            print(f"\n{'='*60}")
            print("Verificando el primer mensaje en detalle...")
            print(f"{'='*60}")
            verificar_mensaje(mensajes[0]['id'])
    else:
        print("Error al obtener mensajes")
