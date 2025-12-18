"""Debug directo del endpoint"""
import asyncio
from sqlmodel import Session
from app.db import engine
from app.routers.crm_mensaje_router import responder_mensaje_whatsapp
from app.schemas.crm_mensaje_responder import ResponderMensajeRequest

async def test():
    request = ResponderMensajeRequest(
        texto="Gracias por tu consulta. Te responderemos pronto."
    )
    
    with Session(engine) as session:
        try:
            result = await responder_mensaje_whatsapp(
                mensaje_id=5,
                request=request,
                session=session
            )
            print("✅ Respuesta:", result)
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()

asyncio.run(test())
