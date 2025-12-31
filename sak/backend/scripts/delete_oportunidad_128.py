"""
Script para eliminar completamente la oportunidad ID 128
"""
import sys
from pathlib import Path

# Agregar el directorio raíz al path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad
from app.models.crm_evento import CRMEvento
from app.models.crm_mensaje import CRMMensaje
from app.models.crm_oportunidad_log_estado import CRMOportunidadLogEstado


def delete_oportunidad(oportunidad_id: int):
    """Elimina completamente una oportunidad y sus relaciones"""
    
    with Session(engine) as session:
        # 1. Verificar que existe la oportunidad
        oportunidad = session.get(CRMOportunidad, oportunidad_id)
        if not oportunidad:
            print(f"❌ Oportunidad {oportunidad_id} no existe")
            return False
        
        print(f"📋 Oportunidad encontrada: {oportunidad.titulo or 'Sin título'}")
        print(f"   Estado: {oportunidad.estado}")
        print(f"   Contacto ID: {oportunidad.contacto_id}")
        
        # 2. Contar registros relacionados
        eventos = session.exec(
            select(CRMEvento).where(CRMEvento.oportunidad_id == oportunidad_id)
        ).all()
        
        mensajes = session.exec(
            select(CRMMensaje).where(CRMMensaje.oportunidad_id == oportunidad_id)
        ).all()
        
        logs = session.exec(
            select(CRMOportunidadLogEstado).where(CRMOportunidadLogEstado.oportunidad_id == oportunidad_id)
        ).all()
        
        print(f"\n📊 Registros relacionados:")
        print(f"   - Eventos: {len(eventos)}")
        print(f"   - Mensajes: {len(mensajes)}")
        print(f"   - Logs de estado: {len(logs)}")
        
        # 3. Confirmar eliminación
        respuesta = input(f"\n⚠️  ¿Confirmas eliminar la oportunidad {oportunidad_id}? (si/no): ")
        if respuesta.lower() not in ['si', 's', 'yes', 'y']:
            print("❌ Operación cancelada")
            return False
        
        try:
            # 4. Eliminar eventos
            for evento in eventos:
                session.delete(evento)
            print(f"✅ {len(eventos)} eventos eliminados")
            
            # 5. Desvincular mensajes (opción conservadora)
            for mensaje in mensajes:
                mensaje.oportunidad_id = None
                session.add(mensaje)
            print(f"✅ {len(mensajes)} mensajes desvinculados")
            
            # 6. Eliminar logs (aunque deberían eliminarse por CASCADE)
            for log in logs:
                session.delete(log)
            print(f"✅ {len(logs)} logs eliminados")
            
            # 7. Eliminar la oportunidad
            session.delete(oportunidad)
            
            # 8. Commit
            session.commit()
            print(f"\n✅ Oportunidad {oportunidad_id} eliminada exitosamente")
            return True
            
        except Exception as e:
            session.rollback()
            print(f"\n❌ Error al eliminar: {e}")
            return False


if __name__ == "__main__":
    print("=" * 60)
    print("ELIMINACIÓN DE OPORTUNIDAD 128")
    print("=" * 60)
    
    success = delete_oportunidad(128)
    
    if success:
        print("\n🎉 Proceso completado exitosamente")
    else:
        print("\n⚠️  Proceso terminado sin cambios")
