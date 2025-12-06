"""
Script para poblar fecha_estado en crm_eventos con la fecha_evento de cada registro.
Para eventos existentes, asumimos que la fecha_estado debería ser la fecha_evento.
"""
from sqlmodel import Session, select
from app.db import engine
from app.models import CRMEvento


def poblar_fecha_estado_eventos():
    """Actualiza fecha_estado con fecha_evento para todos los eventos que no tienen fecha_estado."""
    
    with Session(engine) as session:
        # Buscar todos los eventos
        eventos = session.exec(select(CRMEvento)).all()
        
        total = len(eventos)
        actualizados = 0
        sin_cambios = 0
        
        print(f"📊 Total de eventos encontrados: {total}")
        print("\n🔄 Procesando eventos...")
        
        for evento in eventos:
            # Si fecha_estado es None o diferente de fecha_evento, actualizar
            if evento.fecha_estado is None or evento.fecha_estado != evento.fecha_evento:
                evento.fecha_estado = evento.fecha_evento
                session.add(evento)
                actualizados += 1
                
                if actualizados <= 10:  # Mostrar solo los primeros 10
                    print(f"   ✅ Evento #{evento.id}: fecha_estado = {evento.fecha_evento}")
            else:
                sin_cambios += 1
        
        # Commit de todos los cambios
        session.commit()
        
        print(f"\n📈 Resumen:")
        print(f"   Total eventos: {total}")
        print(f"   Actualizados: {actualizados}")
        print(f"   Sin cambios: {sin_cambios}")
        print(f"\n✅ Proceso completado exitosamente")


if __name__ == "__main__":
    poblar_fecha_estado_eventos()
