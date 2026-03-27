#!/usr/bin/env python3

from sqlmodel import select
from app.db import get_session
from app.models.proyecto_avance import ProyectoAvance
from app.models.proyecto import Proyecto

def verificar_avances_generados():
    """Verifica los registros de avance generados"""
    
    with next(get_session()) as db:
        # Contar registros por proyecto
        proyectos_ids = [14, 15, 16, 17]
        
        print("=== VERIFICACIÓN DE REGISTROS DE AVANCE ===\n")
        
        total_registros = 0
        
        for proyecto_id in proyectos_ids:
            # Obtener proyecto
            proyecto = db.exec(select(Proyecto).where(Proyecto.id == proyecto_id)).first()
            
            # Obtener todos los avances de este proyecto
            avances = db.exec(
                select(ProyectoAvance)
                .where(ProyectoAvance.proyecto_id == proyecto_id)
                .order_by(ProyectoAvance.fecha_registracion)
            ).all()
            
            if avances:
                print(f"📋 PROYECTO {proyecto_id}: {proyecto.nombre}")
                print(f"   📊 {len(avances)} registros de avance")
                
                total_importe = sum(a.importe for a in avances)
                total_horas = sum(a.horas for a in avances)
                avance_final = max(a.avance for a in avances)
                
                print(f"   💰 Importe total: ${total_importe:,.2f}")
                print(f"   ⏰ Horas totales: {total_horas:,}")
                print(f"   📈 Avance final: {avance_final:.1f}%")
                
                print("   📅 Detalle por período:")
                for avance in avances[-3:]:  # Mostrar últimos 3
                    print(f"      {avance.fecha_registracion.strftime('%Y-%m')}: "
                          f"{avance.avance:.1f}% - ${avance.importe:,.2f} - {avance.horas}h")
                
                print("")
                total_registros += len(avances)
            else:
                print(f"❌ PROYECTO {proyecto_id}: Sin registros de avance")
        
        print(f"✅ TOTAL GENERAL: {total_registros} registros de avance verificados")

if __name__ == "__main__":
    verificar_avances_generados()