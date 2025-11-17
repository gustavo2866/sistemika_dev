"""
Script de verificación de consistencia de datos entre Propiedades y Vacancias.

Verifica:
1. El estado de la propiedad coincide con las fechas de su última vacancia
2. No hay propiedades sin vacancia
3. Propiedades con vacancia activa están en estado correcto (recibida/reparación/disponible)
4. Las fechas de estados siguen orden secuencial
5. Propiedades sin vacancia activa están alquiladas o retiradas
"""

import sys
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.models.propiedad import Propiedad
from app.models.vacancia import Vacancia
from app.db import engine

def verificar_consistencia():
    """Verifica la consistencia de datos entre propiedades y vacancias."""
    
    with Session(engine) as session:
        # Cargar todas las propiedades con sus vacancias
        stmt = select(Propiedad).options(selectinload(Propiedad.vacancias))
        propiedades = session.execute(stmt).scalars().all()
        
        print(f"\n{'='*80}")
        print(f"VERIFICACIÓN DE CONSISTENCIA DE DATOS")
        print(f"{'='*80}\n")
        print(f"Total de propiedades: {len(propiedades)}\n")
        
        errores = []
        advertencias = []
        
        for propiedad in propiedades:
            prop_id = propiedad.id
            prop_nombre = propiedad.nombre
            prop_estado = propiedad.estado
            vacancias = sorted(propiedad.vacancias, key=lambda v: v.id, reverse=True)
            
            # REGLA 1: Toda propiedad debe tener al menos una vacancia
            if not vacancias:
                errores.append({
                    'tipo': 'SIN_VACANCIA',
                    'propiedad_id': prop_id,
                    'propiedad_nombre': prop_nombre,
                    'mensaje': f"Propiedad sin vacancias"
                })
                continue
            
            vacancia_actual = vacancias[0]  # La más reciente
            
            # REGLA 2: Verificar coherencia entre estado de propiedad y vacancia activa
            if vacancia_actual.ciclo_activo:
                # Determinar último estado de la vacancia activa basado en fechas
                ultimo_estado_vacancia = None
                ultima_fecha = None
                
                if vacancia_actual.fecha_retirada:
                    ultimo_estado_vacancia = "5-retirada"
                    ultima_fecha = vacancia_actual.fecha_retirada
                elif vacancia_actual.fecha_alquilada:
                    ultimo_estado_vacancia = "4-alquilada"
                    ultima_fecha = vacancia_actual.fecha_alquilada
                elif vacancia_actual.fecha_disponible:
                    ultimo_estado_vacancia = "3-disponible"
                    ultima_fecha = vacancia_actual.fecha_disponible
                elif vacancia_actual.fecha_en_reparacion:
                    ultimo_estado_vacancia = "2-en_reparacion"
                    ultima_fecha = vacancia_actual.fecha_en_reparacion
                elif vacancia_actual.fecha_recibida:
                    ultimo_estado_vacancia = "1-recibida"
                    ultima_fecha = vacancia_actual.fecha_recibida
                
                if ultimo_estado_vacancia and ultimo_estado_vacancia != prop_estado:
                    errores.append({
                        'tipo': 'ESTADO_INCONSISTENTE',
                        'propiedad_id': prop_id,
                        'propiedad_nombre': prop_nombre,
                        'estado_propiedad': prop_estado,
                        'estado_vacancia': ultimo_estado_vacancia,
                        'vacancia_id': vacancia_actual.id,
                        'mensaje': f"Estado de propiedad ({prop_estado}) no coincide con último estado de vacancia activa ({ultimo_estado_vacancia})"
                    })
                
                # REGLA 3: Vacancia activa debe estar en estado recibida, reparación o disponible
                estados_validos_activa = ["1-recibida", "2-en_reparacion", "3-disponible"]
                if prop_estado not in estados_validos_activa:
                    errores.append({
                        'tipo': 'ESTADO_INVALIDO_VACANCIA_ACTIVA',
                        'propiedad_id': prop_id,
                        'propiedad_nombre': prop_nombre,
                        'estado_propiedad': prop_estado,
                        'vacancia_id': vacancia_actual.id,
                        'mensaje': f"Propiedad con vacancia activa debe estar en estado recibida/reparación/disponible, pero está en {prop_estado}"
                    })
                
                # REGLA 4: Verificar orden secuencial de fechas en vacancia activa
                fechas_ordenadas = []
                if vacancia_actual.fecha_recibida:
                    fechas_ordenadas.append(('recibida', vacancia_actual.fecha_recibida))
                if vacancia_actual.fecha_en_reparacion:
                    fechas_ordenadas.append(('en_reparacion', vacancia_actual.fecha_en_reparacion))
                if vacancia_actual.fecha_disponible:
                    fechas_ordenadas.append(('disponible', vacancia_actual.fecha_disponible))
                if vacancia_actual.fecha_alquilada:
                    fechas_ordenadas.append(('alquilada', vacancia_actual.fecha_alquilada))
                if vacancia_actual.fecha_retirada:
                    fechas_ordenadas.append(('retirada', vacancia_actual.fecha_retirada))
                
                for i in range(len(fechas_ordenadas) - 1):
                    estado_actual, fecha_actual = fechas_ordenadas[i]
                    estado_siguiente, fecha_siguiente = fechas_ordenadas[i + 1]
                    
                    if fecha_actual >= fecha_siguiente:
                        errores.append({
                            'tipo': 'FECHAS_DESORDENADAS',
                            'propiedad_id': prop_id,
                            'propiedad_nombre': prop_nombre,
                            'vacancia_id': vacancia_actual.id,
                            'mensaje': f"Fechas fuera de orden: {estado_actual} ({fecha_actual}) >= {estado_siguiente} ({fecha_siguiente})"
                        })
            
            else:
                # REGLA 5: Sin vacancia activa debe estar alquilada o retirada
                estados_validos_inactiva = ["4-alquilada", "5-retirada"]
                if prop_estado not in estados_validos_inactiva:
                    errores.append({
                        'tipo': 'ESTADO_INVALIDO_SIN_VACANCIA_ACTIVA',
                        'propiedad_id': prop_id,
                        'propiedad_nombre': prop_nombre,
                        'estado_propiedad': prop_estado,
                        'vacancia_id': vacancia_actual.id,
                        'mensaje': f"Propiedad sin vacancia activa debe estar alquilada o retirada, pero está en {prop_estado}"
                    })
                
                # Verificar que la última vacancia tenga fecha de alquilada o retirada
                if prop_estado == "4-alquilada" and not vacancia_actual.fecha_alquilada:
                    advertencias.append({
                        'tipo': 'FALTA_FECHA_ALQUILADA',
                        'propiedad_id': prop_id,
                        'propiedad_nombre': prop_nombre,
                        'vacancia_id': vacancia_actual.id,
                        'mensaje': f"Propiedad en estado alquilada pero la vacancia no tiene fecha_alquilada"
                    })
                
                if prop_estado == "5-retirada" and not vacancia_actual.fecha_retirada:
                    advertencias.append({
                        'tipo': 'FALTA_FECHA_RETIRADA',
                        'propiedad_id': prop_id,
                        'propiedad_nombre': prop_nombre,
                        'vacancia_id': vacancia_actual.id,
                        'mensaje': f"Propiedad en estado retirada pero la vacancia no tiene fecha_retirada"
                    })
        
        # Mostrar resultados
        print(f"{'='*80}")
        print(f"RESUMEN DE VERIFICACIÓN")
        print(f"{'='*80}\n")
        
        if not errores and not advertencias:
            print("✅ No se encontraron inconsistencias.\n")
        else:
            if errores:
                print(f"❌ ERRORES CRÍTICOS: {len(errores)}\n")
                for i, error in enumerate(errores, 1):
                    print(f"{i}. [{error['tipo']}] Propiedad #{error['propiedad_id']} - {error['propiedad_nombre']}")
                    print(f"   {error['mensaje']}")
                    if 'vacancia_id' in error:
                        print(f"   Vacancia ID: {error['vacancia_id']}")
                    if 'estado_propiedad' in error:
                        print(f"   Estado propiedad: {error['estado_propiedad']}")
                    if 'estado_vacancia' in error:
                        print(f"   Estado vacancia: {error['estado_vacancia']}")
                    print()
            
            if advertencias:
                print(f"⚠️  ADVERTENCIAS: {len(advertencias)}\n")
                for i, adv in enumerate(advertencias, 1):
                    print(f"{i}. [{adv['tipo']}] Propiedad #{adv['propiedad_id']} - {adv['propiedad_nombre']}")
                    print(f"   {adv['mensaje']}")
                    if 'vacancia_id' in adv:
                        print(f"   Vacancia ID: {adv['vacancia_id']}")
                    print()
        
        print(f"{'='*80}\n")
        
        # Retornar código de salida
        if errores:
            return 1
        return 0

if __name__ == "__main__":
    try:
        exit_code = verificar_consistencia()
        sys.exit(exit_code)
    except Exception as e:
        print(f"\n❌ Error al ejecutar verificación: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
