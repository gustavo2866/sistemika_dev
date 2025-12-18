"""
Test para el endpoint de responder mensaje WhatsApp
"""
import pytest
from httpx import AsyncClient
from sqlmodel import Session, select

from app.main import app
from app.db import get_session
from app.models import CRMMensaje, CRMContacto, CRMCelular
from app.models.enums import TipoMensaje, CanalMensaje


@pytest.mark.asyncio
async def test_responder_mensaje_whatsapp(monkeypatch):
    """
    Test del endpoint POST /api/crm/mensajes/{id}/responder
    
    Mock de meta-w client para no hacer llamadas reales
    """
    # Mock del metaw_client
    async def mock_enviar_mensaje(*args, **kwargs):
        return {
            "id": "308e4d17-089b-4a13-b9c8-d635130d960a",
            "meta_message_id": "wamid.MOCK123456",
            "status": "sent",
            "to_phone": kwargs["telefono_destino"]
        }
    
    from app.services import metaw_client as metaw_module
    monkeypatch.setattr(metaw_module.metaw_client, "enviar_mensaje", mock_enviar_mensaje)
    
    # Setup: crear mensaje de entrada con contacto
    from app.db import engine
    with Session(engine) as session:
        # Crear contacto
        contacto = CRMContacto(
            nombre_completo="Test Contacto",
            telefonos=[{"numero": "5491156384310", "tipo": "movil"}]
        )
        session.add(contacto)
        session.commit()
        session.refresh(contacto)
        
        # Crear celular activo
        celular = CRMCelular(
            meta_celular_id="14b530aa-ff61-44be-af48-957dabde4f28",
            numero_celular="+15551676015",
            alias="WhatsApp Test",
            activo=True
        )
        session.add(celular)
        session.commit()
        session.refresh(celular)
        
        # Crear mensaje de entrada
        mensaje_entrada = CRMMensaje(
            tipo=TipoMensaje.ENTRADA.value,
            canal=CanalMensaje.WHATSAPP.value,
            contacto_id=contacto.id,
            contacto_referencia="5491156384310",
            contenido="Hola, necesito información"
        )
        session.add(mensaje_entrada)
        session.commit()
        session.refresh(mensaje_entrada)
        
        mensaje_id = mensaje_entrada.id
    
    # Test: responder al mensaje
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            f"/api/crm/mensajes/{mensaje_id}/responder",
            json={
                "texto": "Gracias por tu mensaje. Te responderemos pronto.",
                "template_fallback_name": "notificacion_general",
                "template_fallback_language": "es_AR"
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    
    assert "mensaje_id" in data
    assert data["status"] == "sent"
    assert data["meta_message_id"] == "wamid.MOCK123456"
    assert data["error_message"] is None
    
    # Verificar que se creó mensaje de salida en BD
    with Session(engine) as session:
        mensaje_salida = session.get(CRMMensaje, data["mensaje_id"])
        assert mensaje_salida is not None
        assert mensaje_salida.tipo == TipoMensaje.SALIDA.value
        assert mensaje_salida.contacto_id == contacto.id
        assert mensaje_salida.contenido == "Gracias por tu mensaje. Te responderemos pronto."
        assert mensaje_salida.estado_meta == "sent"
        assert mensaje_salida.origen_externo_id == "wamid.MOCK123456"


@pytest.mark.asyncio
async def test_responder_mensaje_sin_celular():
    """Test error cuando no hay celular activo"""
    from app.db import engine
    with Session(engine) as session:
        # Desactivar todos los celulares
        stmt = select(CRMCelular)
        celulares = session.exec(stmt).all()
        for cel in celulares:
            cel.activo = False
        session.commit()
        
        # Crear mensaje
        contacto = CRMContacto(nombre_completo="Test")
        session.add(contacto)
        session.commit()
        
        mensaje = CRMMensaje(
            tipo=TipoMensaje.ENTRADA.value,
            canal=CanalMensaje.WHATSAPP.value,
            contacto_id=contacto.id,
            contacto_referencia="5491156384310"
        )
        session.add(mensaje)
        session.commit()
        mensaje_id = mensaje.id
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            f"/api/crm/mensajes/{mensaje_id}/responder",
            json={"texto": "Test"}
        )
    
    assert response.status_code == 404
    assert "celular" in response.json()["detail"].lower()


if __name__ == "__main__":
    import asyncio
    
    print("🧪 Ejecutando tests de responder mensaje...")
    asyncio.run(test_responder_mensaje_whatsapp(lambda *args, **kwargs: None))
    print("✅ Tests completados")
