"""
Script para generar mensajes de prueba con datos realistas
"""
from datetime import datetime, UTC, timedelta
from sqlmodel import Session
from app.db import engine
from app.models import CRMMensaje

# Datos de prueba
mensajes_prueba = [
    {
        "tipo": "entrada",
        "canal": "whatsapp",
        "contacto_referencia": "+5491123456789",
        "asunto": "Consulta sobre departamento en Palermo",
        "contenido": "Hola! Vi en su página un departamento de 2 ambientes en Palermo. Me gustaría más información sobre precio y disponibilidad.",
        "estado": "nuevo",
        "fecha_mensaje": datetime.now(UTC) - timedelta(hours=2),
        "responsable_id": 1,
    },
    {
        "tipo": "entrada",
        "canal": "email",
        "contacto_referencia": "maria.gonzalez@email.com",
        "asunto": "Interesada en oficina en Recoleta",
        "contenido": "Buenos días, estoy buscando una oficina para mi emprendimiento. Vi que tienen opciones en Recoleta. ¿Podrían enviarme más detalles? Gracias.",
        "estado": "nuevo",
        "fecha_mensaje": datetime.now(UTC) - timedelta(hours=5),
        "responsable_id": 1,
    },
    {
        "tipo": "entrada",
        "canal": "whatsapp",
        "contacto_referencia": "+5491187654321",
        "asunto": "Pregunta sobre casa en Caballito",
        "contenido": "Hola, quiero información sobre la casa de 3 dormitorios que tienen en Caballito. ¿Está disponible para visita este fin de semana?",
        "estado": "nuevo",
        "fecha_mensaje": datetime.now(UTC) - timedelta(hours=1),
        "responsable_id": 1,
    },
    {
        "tipo": "entrada",
        "canal": "email",
        "contacto_referencia": "juan.perez@empresa.com",
        "asunto": "Consulta urgente - Emprendimiento en Belgrano",
        "contenido": "Estimados, necesito información sobre el emprendimiento que están construyendo en Belgrano. Específicamente sobre unidades de 1 dormitorio. ¿Tienen planos y lista de precios?",
        "estado": "nuevo",
        "fecha_mensaje": datetime.now(UTC) - timedelta(minutes=30),
        "responsable_id": 1,
    },
    {
        "tipo": "entrada",
        "canal": "whatsapp",
        "contacto_referencia": "+5491199887766",
        "asunto": "Local comercial en Microcentro",
        "contenido": "Buenas tardes! Estoy interesado en alquilar un local comercial en la zona de Microcentro para abrir una cafetería. ¿Tienen opciones disponibles?",
        "estado": "nuevo",
        "fecha_mensaje": datetime.now(UTC) - timedelta(hours=3),
        "responsable_id": 1,
    },
]

def generar_mensajes():
    with Session(engine) as session:
        print("\n" + "="*70)
        print("GENERANDO MENSAJES DE PRUEBA")
        print("="*70 + "\n")
        
        created_count = 0
        
        for msg_data in mensajes_prueba:
            # Verificar si ya existe un mensaje con esa referencia reciente
            mensaje = CRMMensaje(**msg_data)
            session.add(mensaje)
            created_count += 1
            print(f"✓ Mensaje creado: {mensaje.asunto}")
            print(f"  Canal: {mensaje.canal} | Ref: {mensaje.contacto_referencia}")
        
        session.commit()
        
        print("\n" + "="*70)
        print(f"✅ {created_count} mensajes de prueba creados exitosamente")
        print("="*70)
        print("\nPuedes verlos en: http://localhost:3000/crm/mensajes")
        print("Todos están en estado 'nuevo' y listos para responder\n")


if __name__ == "__main__":
    generar_mensajes()
