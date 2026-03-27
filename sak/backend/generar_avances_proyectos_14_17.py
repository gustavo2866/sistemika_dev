#!/usr/bin/env python3

from decimal import Decimal
from datetime import date
import random
from sqlmodel import select
from app.db import get_session
from app.models.proy_presupuesto import ProyPresupuesto
from app.models.proyecto_avance import ProyectoAvance
from app.models.proyecto import Proyecto

def generar_avances_proyectos():
    """Genera registros de avance para proyectos 14-17 desde marzo a diciembre 2025"""
    
    # Períodos de marzo a diciembre 2025
    periodos = [
        (202503, date(2025, 3, 31)),
        (202504, date(2025, 4, 30)),
        (202505, date(2025, 5, 31)),
        (202506, date(2025, 6, 30)),
        (202507, date(2025, 7, 31)),
        (202508, date(2025, 8, 31)),
        (202509, date(2025, 9, 30)),
        (202510, date(2025, 10, 31)),
        (202511, date(2025, 11, 30)),
        (202512, date(2025, 12, 31)),
    ]
    
    proyectos_ids = [14, 15, 16, 17]
    
    with next(get_session()) as db:
        # Obtener datos base de proyectos
        proyectos = db.exec(select(Proyecto).where(Proyecto.id.in_(proyectos_ids))).all()
        proyectos_dict = {p.id: p for p in proyectos}
        
        # Obtener presupuestos agrupados por proyecto
        presupuestos = db.exec(select(ProyPresupuesto).where(ProyPresupuesto.proyecto_id.in_(proyectos_ids))).all()
        
        # Agrupar presupuestos por proyecto
        presupuestos_por_proyecto = {}
        for pres in presupuestos:
            if pres.proyecto_id not in presupuestos_por_proyecto:
                presupuestos_por_proyecto[pres.proyecto_id] = []
            presupuestos_por_proyecto[pres.proyecto_id].append(pres)
        
        # Generar avances
        avances_generados = []
        
        for proyecto_id in proyectos_ids:
            proyecto = proyectos_dict[proyecto_id]
            presups_proyecto = presupuestos_por_proyecto.get(proyecto_id, [])
            
            # Calcular presupuesto base promedio
            if presups_proyecto:
                total_presupuesto = sum(p.mo_propia + p.mo_terceros + p.materiales for p in presups_proyecto)
                presupuesto_promedio = total_presupuesto / len(presups_proyecto)
            else:
                presupuesto_promedio = Decimal('50000000')  # Valor por defecto
                
            # Superficie del proyecto (para calcular horas proporcionales)
            superficie_proyecto = proyecto.superficie or Decimal('85.0')
            
            # Generar avance progresivo realista para cada período
            avance_acumulado = Decimal('5.0')  # Empezar con 5%
            
            for i, (periodo_code, fecha_reg) in enumerate(periodos):
                # Incremento de avance realista (más al principio, se desacelera hacia el final)
                if i < 3:  # Primeros 3 meses: 8-15%
                    incremento = Decimal(str(random.uniform(8.0, 15.0)))
                elif i < 6:  # Meses 4-6: 10-18%
                    incremento = Decimal(str(random.uniform(10.0, 18.0)))
                elif i < 8:  # Meses 7-8: 12-20%
                    incremento = Decimal(str(random.uniform(12.0, 20.0)))
                else:  # Últimos meses: 5-12% (finalización)
                    incremento = Decimal(str(random.uniform(5.0, 12.0)))
                
                avance_acumulado += incremento
                
                # Asegurar que no exceda 100%
                if avance_acumulado > Decimal('100.0'):
                    avance_acumulado = Decimal('100.0')
                
                # Calcular importe proporcional al avance
                # Usar el incremento de este período, no el acumulado
                factor_avance = incremento / Decimal('100.0')
                importe_periodo = presupuesto_promedio * factor_avance
                
                # Agregar variación realista (±15%)
                variacion = Decimal(str(random.uniform(0.85, 1.15)))
                importe_final = importe_periodo * variacion
                
                # Calcular horas proporcionales a importe y superficie
                # Base: superficie más alta = más horas, importe más alto = más horas
                factor_superficie = superficie_proyecto / Decimal('100.0')
                factor_importe = importe_final / Decimal('10000000')  # Normalizar por 10M
                
                horas_base = 120 + (factor_superficie * 80) + (factor_importe * 60)
                horas_final = int(horas_base * Decimal(str(random.uniform(0.8, 1.2))))
                
                # Comentarios variados según el avance
                comentarios = [
                    f"Avance del {incremento:.1f}% en obras civiles y estructurales",
                    f"Progreso en instalaciones - {incremento:.1f}% completado",
                    f"Avances en {incremento:.1f}% - cumplimiento de cronograma",
                    f"Desarrollo de trabajos especializados - {incremento:.1f}%",
                    f"Actividades de período - avance del {incremento:.1f}%",
                ]
                comentario = random.choice(comentarios)
                
                # Crear registro de avance
                avance = ProyectoAvance(
                    proyecto_id=proyecto_id,
                    horas=horas_final,
                    avance=avance_acumulado,  # Avance acumulado total
                    importe=importe_final,    # Importe del incremento de este período
                    comentario=comentario,
                    fecha_registracion=fecha_reg
                )
                
                avances_generados.append(avance)
                
                print(f"✅ Proyecto {proyecto_id} - {fecha_reg.strftime('%Y-%m')}: "
                      f"Avance {avance_acumulado:.1f}% (+{incremento:.1f}%), "
                      f"Importe: ${importe_final:,.2f}, "
                      f"Horas: {horas_final}")
                
                # Si llegó al 100%, no generar más períodos para este proyecto
                if avance_acumulado >= Decimal('100.0'):
                    print(f"🏁 Proyecto {proyecto_id} completado")
                    break
        
        # Guardar todos los registros
        db.add_all(avances_generados)
        db.commit()
        
        print(f"\n✅ Se generaron {len(avances_generados)} registros de avance")
        
        # Resumen por proyecto
        print("\n=== RESUMEN ===")
        for proyecto_id in proyectos_ids:
            avances_proyecto = [a for a in avances_generados if a.proyecto_id == proyecto_id]
            if avances_proyecto:
                total_importe = sum(a.importe for a in avances_proyecto)
                total_horas = sum(a.horas for a in avances_proyecto)
                avance_final = max(a.avance for a in avances_proyecto)
                print(f"Proyecto {proyecto_id}: {len(avances_proyecto)} registros, "
                      f"Avance final: {avance_final:.1f}%, "
                      f"Importe total: ${total_importe:,.2f}, "
                      f"Horas totales: {total_horas}")

if __name__ == "__main__":
    generar_avances_proyectos()