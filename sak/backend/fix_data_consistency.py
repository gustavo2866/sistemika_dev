"""
Script para corregir automáticamente las inconsistencias de datos entre Propiedades y Vacancias.

Correcciones:
1. Actualiza el estado de la propiedad para que coincida con su última vacancia activa
2. Ajusta fechas desordenadas agregando segundos de diferencia
3. Crea vacancias iniciales para propiedades sin vacancias
"""

import sys
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.models.propiedad import Propiedad
from app.models.vacancia import Vacancia
from app.db import engine

def fix_inconsistencies(dry_run: bool = True):
    """
    Corrige las inconsistencias de datos.
    
    Args:
        dry_run: Si es True, solo muestra qué se corregiría sin aplicar cambios
    """
    
    with Session(engine) as session:
        print(f"\n{'='*80}")
        print(f"CORRECCIÓN DE INCONSISTENCIAS DE DATOS")
        print(f"Modo: {'DRY RUN (simulación)' if dry_run else 'APLICANDO CAMBIOS'}")
        print(f"{'='*80}\n")
        
        # Cargar todas las propiedades con sus vacancias
        stmt = select(Propiedad).options(selectinload(Propiedad.vacancias))
        propiedades = session.execute(stmt).scalars().all()
        
        correcciones = []
        
        for propiedad in propiedades:
            prop_id = propiedad.id
            prop_nombre = propiedad.nombre
            prop_estado = propiedad.estado
            vacancias = sorted(propiedad.vacancias, key=lambda v: v.id, reverse=True)
            
            # CORRECCIÓN 1: Crear vacancia para propiedades sin vacancia
            if not vacancias:
                print(f"🔧 Propiedad #{prop_id} - {prop_nombre}")
                print(f"   Creando vacancia inicial...")
                
                if not dry_run:
                    nueva_vacancia = Vacancia(
                        propiedad_id=prop_id,
                        ciclo_activo=True,
                        fecha_recibida=propiedad.estado_fecha or datetime.now()
                    )
                    session.add(nueva_vacancia)
                    correcciones.append(f"Creada vacancia para propiedad #{prop_id}")
                else:
                    correcciones.append(f"[DRY RUN] Crear vacancia para propiedad #{prop_id}")
                print()
                continue
            
            vacancia_actual = vacancias[0]
            
            # CORRECCIÓN 2: Ajustar fechas desordenadas
            if vacancia_actual.ciclo_activo:
                fechas = []
                if vacancia_actual.fecha_recibida:
                    fechas.append(('recibida', vacancia_actual.fecha_recibida))
                if vacancia_actual.fecha_en_reparacion:
                    fechas.append(('en_reparacion', vacancia_actual.fecha_en_reparacion))
                if vacancia_actual.fecha_disponible:
                    fechas.append(('disponible', vacancia_actual.fecha_disponible))
                if vacancia_actual.fecha_alquilada:
                    fechas.append(('alquilada', vacancia_actual.fecha_alquilada))
                if vacancia_actual.fecha_retirada:
                    fechas.append(('retirada', vacancia_actual.fecha_retirada))
                
                fechas_corregidas = False
                for i in range(len(fechas) - 1):
                    estado_actual, fecha_actual = fechas[i]
                    estado_siguiente, fecha_siguiente = fechas[i + 1]
                    
                    if fecha_actual >= fecha_siguiente:
                        print(f"🔧 Propiedad #{prop_id} - {prop_nombre}")
                        print(f"   Vacancia #{vacancia_actual.id}")
                        print(f"   Ajustando fechas desordenadas: {estado_actual} >= {estado_siguiente}")
                        
                        if not dry_run:
                            # Ajustar fecha siguiente para que sea 1 minuto después
                            nueva_fecha = fecha_actual + timedelta(minutes=1)
                            
                            if estado_siguiente == 'en_reparacion':
                                vacancia_actual.fecha_en_reparacion = nueva_fecha
                            elif estado_siguiente == 'disponible':
                                vacancia_actual.fecha_disponible = nueva_fecha
                            elif estado_siguiente == 'alquilada':
                                vacancia_actual.fecha_alquilada = nueva_fecha
                            elif estado_siguiente == 'retirada':
                                vacancia_actual.fecha_retirada = nueva_fecha
                            
                            correcciones.append(
                                f"Ajustada fecha {estado_siguiente} de vacancia #{vacancia_actual.id} "
                                f"a {nueva_fecha}"
                            )
                        else:
                            correcciones.append(
                                f"[DRY RUN] Ajustar fecha {estado_siguiente} de vacancia #{vacancia_actual.id}"
                            )
                        
                        fechas_corregidas = True
                        print()
                
                # CORRECCIÓN 3: Sincronizar estado de propiedad con vacancia activa
                ultimo_estado_vacancia = None
                if vacancia_actual.fecha_retirada:
                    ultimo_estado_vacancia = "5-retirada"
                elif vacancia_actual.fecha_alquilada:
                    ultimo_estado_vacancia = "4-alquilada"
                elif vacancia_actual.fecha_disponible:
                    ultimo_estado_vacancia = "3-disponible"
                elif vacancia_actual.fecha_en_reparacion:
                    ultimo_estado_vacancia = "2-en_reparacion"
                elif vacancia_actual.fecha_recibida:
                    ultimo_estado_vacancia = "1-recibida"
                
                if ultimo_estado_vacancia and ultimo_estado_vacancia != prop_estado:
                    print(f"🔧 Propiedad #{prop_id} - {prop_nombre}")
                    print(f"   Estado actual: {prop_estado}")
                    print(f"   Estado según vacancia: {ultimo_estado_vacancia}")
                    print(f"   Sincronizando estado...")
                    
                    if not dry_run:
                        propiedad.estado = ultimo_estado_vacancia
                        correcciones.append(
                            f"Actualizado estado de propiedad #{prop_id} de {prop_estado} a {ultimo_estado_vacancia}"
                        )
                    else:
                        correcciones.append(
                            f"[DRY RUN] Actualizar estado de propiedad #{prop_id} a {ultimo_estado_vacancia}"
                        )
                    print()
        
        # Commit si no es dry run
        if not dry_run and correcciones:
            session.commit()
            print(f"✅ Cambios guardados en la base de datos.\n")
        elif dry_run and correcciones:
            print(f"ℹ️  Modo simulación - no se aplicaron cambios.\n")
        
        # Resumen
        print(f"{'='*80}")
        print(f"RESUMEN")
        print(f"{'='*80}\n")
        
        if correcciones:
            print(f"Total de correcciones: {len(correcciones)}\n")
            for i, corr in enumerate(correcciones, 1):
                print(f"{i}. {corr}")
            print()
        else:
            print("✅ No se encontraron inconsistencias para corregir.\n")
        
        print(f"{'='*80}\n")
        
        return len(correcciones)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Corregir inconsistencias de datos')
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Aplicar las correcciones (por defecto solo simula)'
    )
    
    args = parser.parse_args()
    
    try:
        num_correcciones = fix_inconsistencies(dry_run=not args.apply)
        
        if not args.apply and num_correcciones > 0:
            print("💡 Para aplicar las correcciones, ejecuta:")
            print("   python fix_data_consistency.py --apply\n")
        
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error al ejecutar correcciones: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
