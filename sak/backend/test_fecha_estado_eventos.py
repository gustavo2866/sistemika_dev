"""
Script de prueba para verificar que fecha_estado se actualiza automáticamente en CRMEvento
"""
from datetime import datetime, timedelta
from sqlmodel import Session, select

from app.db import engine
from app.models import CRMEvento, CRMOportunidad, User


def test_fecha_estado_eventos():
    """Verifica que fecha_estado se actualiza automáticamente al cambiar el estado."""
    
    with Session(engine) as session:
        # Buscar un evento existente o crear uno de prueba
        evento = session.exec(select(CRMEvento).limit(1)).first()
        
        if not evento:
            # Si no hay eventos, buscar oportunidad y usuario para crear uno
            oportunidad = session.exec(select(CRMOportunidad).limit(1)).first()
            usuario = session.exec(select(User).limit(1)).first()
            
            if not oportunidad or not usuario:
                print("❌ No hay datos suficientes (oportunidad y usuario) para crear evento de prueba")
                return
            
            evento = CRMEvento(
                oportunidad_id=oportunidad.id,
                titulo="Evento de prueba fecha_estado",
                tipo_evento="llamada",
                fecha_evento=datetime.now(),
                estado_evento="1-pendiente",
                asignado_a_id=usuario.id,
            )
            session.add(evento)
            session.commit()
            session.refresh(evento)
            print(f"✅ Evento creado: #{evento.id}")
        
        print(f"\n📋 Evento #{evento.id}: {evento.titulo}")
        print(f"   Estado actual: {evento.estado_evento}")
        print(f"   fecha_estado actual: {evento.fecha_estado}")
        
        # Verificar que fecha_estado fue establecida en la creación
        if evento.fecha_estado is None:
            print("❌ ERROR: fecha_estado es None después de crear el evento")
            return
        else:
            print("✅ fecha_estado se estableció automáticamente en la creación")
        
        # Guardar fecha_estado original
        fecha_estado_original = evento.fecha_estado
        
        # Esperar un momento para que el timestamp sea diferente
        import time
        time.sleep(0.1)
        
        # Cambiar el estado usando el método set_estado
        estado_nuevo = "2-realizado" if evento.estado_evento == "1-pendiente" else "1-pendiente"
        evento.set_estado(estado_nuevo)
        session.add(evento)
        session.commit()
        session.refresh(evento)
        
        print(f"\n🔄 Estado cambiado a: {evento.estado_evento}")
        print(f"   fecha_estado nueva: {evento.fecha_estado}")
        
        if evento.fecha_estado != fecha_estado_original:
            print("✅ fecha_estado se actualizó correctamente con set_estado()")
        else:
            print("❌ ERROR: fecha_estado NO se actualizó con set_estado()")
        
        # Probar cambio directo de estado_evento (debería activar el event listener)
        fecha_estado_antes = evento.fecha_estado
        time.sleep(0.1)
        
        estado_nuevo2 = "3-cancelado"
        evento.estado_evento = estado_nuevo2
        session.add(evento)
        session.commit()
        session.refresh(evento)
        
        print(f"\n🔄 Estado cambiado directamente a: {evento.estado_evento}")
        print(f"   fecha_estado nueva: {evento.fecha_estado}")
        
        if evento.fecha_estado != fecha_estado_antes:
            print("✅ fecha_estado se actualizó automáticamente con event listener")
        else:
            print("⚠️  fecha_estado NO se actualizó (event listener podría no estar funcionando)")
        
        print("\n✅ Prueba completada exitosamente")


if __name__ == "__main__":
    test_fecha_estado_eventos()
