"""
Script para corregir oportunidades con estados inválidos en la base de datos.
"""
from sqlmodel import Session, update
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad
from app.models.enums import EstadoOportunidad


def fix_invalid_estados():
    """Corrige los estados inválidos encontrados."""
    
    with Session(engine) as session:
        print("🔧 INICIANDO CORRECCIÓN DE ESTADOS INVÁLIDOS...")
        print("=" * 80)
        
        # Mapeo de correcciones basado en el análisis anterior
        correcciones = [
            {
                "estado_invalido": "2-contacto_inicial",
                "estado_correcto": EstadoOportunidad.ABIERTA.value,
                "ids": [60, 76, 78, 82, 95, 101],
                "razon": "contacto_inicial -> abierta (primer contacto establecido)"
            },
            {
                "estado_invalido": "3",
                "estado_correcto": EstadoOportunidad.COTIZA.value,
                "ids": [3, 4, 17], 
                "razon": "estado '3' incompleto -> cotiza (por el número 3)"
            },
            {
                "estado_invalido": "3-visita_programada",
                "estado_correcto": EstadoOportunidad.VISITA.value,
                "ids": [68, 73, 77, 81, 84, 89, 97, 103],
                "razon": "visita_programada -> visita (etapa de visitas)"
            },
            {
                "estado_invalido": "4-propuesta_enviada", 
                "estado_correcto": EstadoOportunidad.COTIZA.value,
                "ids": [55, 67, 72, 75, 87, 92],
                "razon": "propuesta_enviada -> cotiza (etapa de cotización)"
            },
            {
                "estado_invalido": "5-negociacion",
                "estado_correcto": EstadoOportunidad.RESERVA.value,
                "ids": [56, 57, 58, 61, 64, 70, 74, 79, 85, 94, 104],
                "razon": "negociacion -> reserva (etapa de negociación avanzada)"
            },
            {
                "estado_invalido": "6-ganada",
                "estado_correcto": EstadoOportunidad.GANADA.value,
                "ids": [66, 83, 88, 91, 98, 99],
                "razon": "6-ganada -> 5-ganada (corrección de numeración)"
            },
            {
                "estado_invalido": "7-perdida",
                "estado_correcto": EstadoOportunidad.PERDIDA.value,
                "ids": [65, 80, 90, 96, 100, 102],
                "razon": "7-perdida -> 6-perdida (corrección de numeración)"
            }
        ]
        
        total_corregidas = 0
        
        for correccion in correcciones:
            estado_inv = correccion["estado_invalido"]
            estado_cor = correccion["estado_correcto"] 
            ids = correccion["ids"]
            razon = correccion["razon"]
            
            print(f"Corrigiendo: {estado_inv} -> {estado_cor}")
            print(f"Razón: {razon}")
            print(f"IDs afectadas: {ids}")
            
            # Ejecutar la actualización
            try:
                result = session.exec(
                    update(CRMOportunidad)
                    .where(CRMOportunidad.id.in_(ids))
                    .where(CRMOportunidad.estado == estado_inv)
                    .values(estado=estado_cor)
                )
                
                rows_affected = result.rowcount
                total_corregidas += rows_affected
                print(f"✅ Actualizadas: {rows_affected} oportunidades")
                
            except Exception as e:
                print(f"❌ Error: {e}")
            
            print("-" * 50)
        
        # Confirmar los cambios
        session.commit()
        
        print("=" * 80)
        print(f"🎉 CORRECCIÓN COMPLETADA")
        print(f"Total de oportunidades corregidas: {total_corregidas}")
        print()
        print("Se recomienda:")
        print("1. Verificar el resultado ejecutando check_invalid_estados.py")
        print("2. Revisar las oportunidades corregidas en el frontend")
        print("3. Informar a los usuarios sobre los cambios de estados")


if __name__ == "__main__":
    # Confirmar antes de ejecutar
    print("⚠️  ADVERTENCIA: Este script modificará los estados de 46 oportunidades")
    print("¿Estás seguro de que quieres continuar? (y/N): ", end="")
    confirmacion = input().strip().lower()
    
    if confirmacion in ['y', 'yes', 'sí', 'si']:
        fix_invalid_estados()
    else:
        print("❌ Operación cancelada por el usuario")