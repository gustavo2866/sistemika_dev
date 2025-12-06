"""
Script para actualizar títulos de oportunidades que tienen formato "Oportunidad #XXXX"
Genera títulos automáticos basados en tipo_operacion y tipo_propiedad.
"""
import random
from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad
from app.models.crm_catalogos import CRMTipoOperacion
from app.models.tipo_propiedad import TipoPropiedad


def generar_titulo_automatico(
    oportunidad: CRMOportunidad,
    tipo_operacion: CRMTipoOperacion | None,
    tipo_propiedad: TipoPropiedad | None,
    tipos_propiedad_disponibles: list[TipoPropiedad]
) -> str:
    """
    Genera un título automático basado en tipo_operacion y tipo_propiedad.
    Formato: "{Tipo Operación} {Tipo Propiedad}"
    Ejemplo: "Venta Departamento", "Alquiler Casa"
    """
    # Obtener tipo de operación
    if tipo_operacion:
        tipo_op_texto = tipo_operacion.nombre
    else:
        tipo_op_texto = "Operación"
    
    # Obtener tipo de propiedad
    if tipo_propiedad:
        tipo_prop_texto = tipo_propiedad.nombre
    else:
        # Si no tiene tipo de propiedad, seleccionar uno al azar
        if tipos_propiedad_disponibles:
            tipo_prop_random = random.choice(tipos_propiedad_disponibles)
            tipo_prop_texto = tipo_prop_random.nombre
            # Actualizar la oportunidad con el tipo seleccionado
            oportunidad.tipo_propiedad_id = tipo_prop_random.id
        else:
            tipo_prop_texto = "Propiedad"
    
    return f"{tipo_op_texto} {tipo_prop_texto}"


def main():
    with Session(engine) as session:
        # Cargar todos los tipos de propiedad disponibles
        tipos_propiedad_disponibles = session.exec(
            select(TipoPropiedad).where(TipoPropiedad.activo == True)
        ).all()
        
        print(f"📋 Tipos de propiedad disponibles: {len(tipos_propiedad_disponibles)}")
        for tp in tipos_propiedad_disponibles:
            print(f"   - {tp.nombre}")
        
        # Buscar oportunidades con formato "Oportunidad #XXXX"
        statement = (
            select(CRMOportunidad)
            .where(CRMOportunidad.titulo.like("Oportunidad #%"))
        )
        oportunidades = session.exec(statement).all()
        
        print(f"\n🔍 Encontradas {len(oportunidades)} oportunidades con formato 'Oportunidad #XXXX'")
        
        if not oportunidades:
            print("✅ No hay oportunidades que actualizar")
            return
        
        # Cargar relaciones necesarias
        tipos_operacion_cache = {}
        tipos_propiedad_cache = {}
        
        # Pre-cargar todos los tipos de operación
        for tipo_op in session.exec(select(CRMTipoOperacion)).all():
            tipos_operacion_cache[tipo_op.id] = tipo_op
        
        # Pre-cargar todos los tipos de propiedad
        for tipo_prop in session.exec(select(TipoPropiedad)).all():
            tipos_propiedad_cache[tipo_prop.id] = tipo_prop
        
        # Actualizar cada oportunidad
        updated = 0
        sin_tipo_prop = 0
        
        print("\n🔄 Actualizando títulos...")
        for oportunidad in oportunidades:
            tipo_operacion = tipos_operacion_cache.get(oportunidad.tipo_operacion_id)
            tipo_propiedad = tipos_propiedad_cache.get(oportunidad.tipo_propiedad_id)
            
            if not tipo_propiedad:
                sin_tipo_prop += 1
            
            titulo_nuevo = generar_titulo_automatico(
                oportunidad,
                tipo_operacion,
                tipo_propiedad,
                tipos_propiedad_disponibles
            )
            
            titulo_anterior = oportunidad.titulo
            oportunidad.titulo = titulo_nuevo
            updated += 1
            
            if updated <= 10:  # Mostrar los primeros 10 ejemplos
                print(f"   {updated}. ID {oportunidad.id}: '{titulo_anterior}' → '{titulo_nuevo}'")
            elif updated % 100 == 0:
                print(f"   Procesadas {updated} oportunidades...")
        
        # Confirmar cambios
        print(f"\n📊 Resumen:")
        print(f"   - Total actualizadas: {updated}")
        print(f"   - Sin tipo de propiedad original: {sin_tipo_prop}")
        print(f"   - Tipo de propiedad asignado aleatoriamente: {sin_tipo_prop}")
        
        confirmar = input("\n¿Confirmar cambios? (s/n): ").lower()
        if confirmar == 's':
            session.commit()
            print("\n✅ Títulos actualizados exitosamente")
        else:
            session.rollback()
            print("\n❌ Cambios cancelados")


if __name__ == "__main__":
    main()
