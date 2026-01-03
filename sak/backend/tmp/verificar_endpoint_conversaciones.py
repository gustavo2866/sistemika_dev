"""Verificar endpoint de conversaciones con tipo_operacion"""
import requests
import json

url = "http://localhost:8000/crm/mensajes/acciones/conversaciones"
params = {
    "limit": 5,
    "canal": "whatsapp"
}

print("=" * 70)
print("VERIFICAR ENDPOINT DE CONVERSACIONES")
print("=" * 70)
print(f"URL: {url}")
print(f"Params: {params}")
print("\nEnviando request...\n")

try:
    response = requests.get(url, params=params)
    print(f"Status Code: {response.status_code}\n")
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"Total conversaciones: {len(data.get('data', []))}")
        print(f"Has more: {data.get('has_more', False)}")
        print(f"Next cursor: {data.get('next_cursor', 'None')}")
        
        print("\n" + "=" * 70)
        print("CONVERSACIONES:")
        print("=" * 70)
        
        for i, conv in enumerate(data.get('data', []), 1):
            print(f"\n{i}. ID: {conv.get('id')}")
            print(f"   Contacto: {conv.get('contacto_nombre', 'N/A')} (ID: {conv.get('contacto_id')})")
            print(f"   Oportunidad ID: {conv.get('oportunidad_id')}")
            print(f"   Oportunidad Título: {conv.get('oportunidad_titulo', 'N/A')}")
            print(f"   Oportunidad Estado: {conv.get('oportunidad_estado', 'N/A')}")
            print(f"   Oportunidad Activa: {conv.get('oportunidad_activo', 'N/A')}")
            
            # Verificar si tiene tipo_operacion
            tipo_op_nombre = conv.get('oportunidad_tipo_operacion_nombre')
            tipo_op_codigo = conv.get('oportunidad_tipo_operacion_codigo')
            
            if tipo_op_nombre or tipo_op_codigo:
                print(f"   ✅ Tipo Operación: {tipo_op_nombre} ({tipo_op_codigo})")
            else:
                print(f"   ⚠️  Tipo Operación: NULL")
            
            ultimo_msg = conv.get('ultimo_mensaje', {})
            if ultimo_msg:
                contenido = ultimo_msg.get('contenido', '')
                print(f"   Último mensaje: {contenido[:50]}...")
            
            print(f"   Unread: {conv.get('unread_count', 0)}")
            print(f"   Fecha: {conv.get('fecha', 'N/A')}")
        
        print("\n" + "=" * 70)
        print("VERIFICACIÓN:")
        print("=" * 70)
        
        conversaciones_con_tipo = [c for c in data.get('data', []) if c.get('oportunidad_tipo_operacion_nombre')]
        conversaciones_sin_tipo = [c for c in data.get('data', []) if c.get('oportunidad_id') and not c.get('oportunidad_tipo_operacion_nombre')]
        
        print(f"\nConversaciones con tipo_operacion: {len(conversaciones_con_tipo)}")
        print(f"Conversaciones sin tipo_operacion: {len(conversaciones_sin_tipo)}")
        
        if conversaciones_con_tipo:
            print("\n✅ El endpoint SÍ devuelve tipo_operacion correctamente")
        else:
            print("\n⚠️  Ninguna conversación tiene tipo_operacion asignado")
            
    else:
        print(f"❌ Error: {response.json()}")
        
except Exception as e:
    print(f"❌ Error: {e}")
