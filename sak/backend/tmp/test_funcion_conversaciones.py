"""Probar función conversaciones_cursor directamente"""
from app.db import get_session
from app.routers.crm_mensaje_router import conversaciones_cursor

session = next(get_session())

print("=" * 70)
print("PROBAR FUNCIÓN conversaciones_cursor DIRECTAMENTE")
print("=" * 70)

result = conversaciones_cursor(
    session=session,
    canal="whatsapp",
    limit=5
)

print(f"\nTotal conversaciones: {len(result['data'])}")
print(f"Has more: {result['has_more']}")

print("\n" + "=" * 70)
print("CONVERSACIONES:")
print("=" * 70)

for i, conv in enumerate(result['data'], 1):
    print(f"\n{i}. ID: {conv.get('id')}")
    print(f"   Contacto: {conv.get('contacto_nombre')} (ID: {conv.get('contacto_id')})")
    print(f"   Oportunidad ID: {conv.get('oportunidad_id')}")
    print(f"   Oportunidad Título: {conv.get('oportunidad_titulo')}")
    print(f"   Oportunidad Estado: {conv.get('oportunidad_estado')}")
    
    tipo_op_nombre = conv.get('oportunidad_tipo_operacion_nombre')
    tipo_op_codigo = conv.get('oportunidad_tipo_operacion_codigo')
    
    if tipo_op_nombre:
        print(f"   ✅ Tipo Operación: {tipo_op_nombre} ({tipo_op_codigo})")
    elif conv.get('oportunidad_id'):
        print(f"   ⚠️  Tipo Operación: NULL (oportunidad {conv.get('oportunidad_id')})")
    else:
        print(f"   - Sin oportunidad")

print("\n" + "=" * 70)
conversaciones_con_tipo = [c for c in result['data'] if c.get('oportunidad_tipo_operacion_nombre')]
print(f"Conversaciones con tipo_operacion: {len(conversaciones_con_tipo)}")

if conversaciones_con_tipo:
    print("\n✅ La función SÍ devuelve tipo_operacion correctamente")
else:
    print("\n❌ La función NO devuelve tipo_operacion")
