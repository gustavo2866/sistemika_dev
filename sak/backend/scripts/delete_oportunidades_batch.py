"""
Script para eliminar múltiples oportunidades: 119, 136, 129, 130, 131, 132, 133
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


def delete_oportunidad(oportunidad_id: int, session: Session):
    """Elimina completamente una oportunidad y sus relaciones"""
    
    # 1. Verificar que existe la oportunidad
    oportunidad = session.get(CRMOportunidad, oportunidad_id)
    if not oportunidad:
        print(f"  ❌ Oportunidad {oportunidad_id} no existe")
        return False
    
    print(f"  📋 {oportunidad.titulo or 'Sin título'} (Estado: {oportunidad.estado})")
    
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
    
    print(f"     → Eventos: {len(eventos)}, Mensajes: {len(mensajes)}, Logs: {len(logs)}")
    
    # 3. Eliminar eventos
    for evento in eventos:
        session.delete(evento)
    
    # 4. Desvincular mensajes
    for mensaje in mensajes:
        mensaje.oportunidad_id = None
        session.add(mensaje)
    
    # 5. Eliminar logs
    for log in logs:
        session.delete(log)
    
    # 6. Eliminar la oportunidad
    session.delete(oportunidad)
    
    print(f"  ✅ Eliminada")
    return True


def delete_multiple_oportunidades(ids: list[int]):
    """Elimina múltiples oportunidades en una sola transacción"""
    
    with Session(engine) as session:
        try:
            print("\n🔄 Iniciando eliminación...\n")
            
            success_count = 0
            for oportunidad_id in ids:
                print(f"Oportunidad {oportunidad_id}:")
                if delete_oportunidad(oportunidad_id, session):
                    success_count += 1
                print()
            
            # Commit único al final
            session.commit()
            
            print(f"✅ {success_count}/{len(ids)} oportunidades eliminadas exitosamente")
            return True
            
        except Exception as e:
            session.rollback()
            print(f"\n❌ Error al eliminar: {e}")
            import traceback
            traceback.print_exc()
            return False


if __name__ == "__main__":
    print("=" * 60)
    print("ELIMINACIÓN DE OPORTUNIDADES")
    print("=" * 60)
    
    oportunidades_a_eliminar = [119, 136, 129, 130, 131, 132, 133]
    
    success = delete_multiple_oportunidades(oportunidades_a_eliminar)
    
    if success:
        print("\n🎉 Proceso completado exitosamente")
    else:
        print("\n⚠️  Proceso terminado con errores")
