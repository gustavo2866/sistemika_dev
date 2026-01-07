"""
Script para identificar oportunidades con estados inválidos en la base de datos.
"""
import asyncio
from sqlmodel import select, Session
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad
from app.models.enums import EstadoOportunidad


# Estados válidos definidos en el enum
ESTADOS_VALIDOS = [estado.value for estado in EstadoOportunidad]

print("Estados válidos definidos:")
for estado in ESTADOS_VALIDOS:
    print(f"  - {estado}")
print()


def check_invalid_estados():
    """Identifica oportunidades con estados inválidos."""
    
    with Session(engine) as session:
        # Consultar todas las oportunidades
        result = session.exec(
            select(CRMOportunidad.id, CRMOportunidad.titulo, CRMOportunidad.estado, CRMOportunidad.activo)
            .order_by(CRMOportunidad.id)
        )
        oportunidades = result.all()
        
        print(f"Total de oportunidades encontradas: {len(oportunidades)}")
        print()
        
        # Identificar estados inválidos
        oportunidades_invalidas = []
        estados_encontrados = set()
        
        for oportunidad in oportunidades:
            estados_encontrados.add(oportunidad.estado)
            if oportunidad.estado not in ESTADOS_VALIDOS:
                oportunidades_invalidas.append(oportunidad)
        
        print("Todos los estados encontrados en la base de datos:")
        for estado in sorted(estados_encontrados):
            is_valid = estado in ESTADOS_VALIDOS
            status = "✓ VÁLIDO" if is_valid else "✗ INVÁLIDO"
            print(f"  - {estado} ({status})")
        print()
        
        if oportunidades_invalidas:
            print(f"🚨 OPORTUNIDADES CON ESTADOS INVÁLIDOS ({len(oportunidades_invalidas)}):")
            print("=" * 80)
            for oportunidad in oportunidades_invalidas:
                activo_status = "ACTIVA" if oportunidad.activo else "INACTIVA"
                print(f"ID: {oportunidad.id:4d} | Estado: {oportunidad.estado:20s} | {activo_status} | Título: {oportunidad.titulo or 'Sin título'}")
            
            print("\n" + "=" * 80)
            print(f"RESUMEN: {len(oportunidades_invalidas)} oportunidades tienen estados inválidos")
            
            # Contar por estado inválido
            from collections import Counter
            estados_invalidos = [op.estado for op in oportunidades_invalidas]
            contador = Counter(estados_invalidos)
            print("\nDistribución de estados inválidos:")
            for estado, count in contador.items():
                print(f"  - {estado}: {count} oportunidades")
                
        else:
            print("✅ Todas las oportunidades tienen estados válidos")
        
        # Generar query SQL para corrección si hay errores
        if oportunidades_invalidas:
            print("\n" + "=" * 80)
            print("🔧 QUERIES SQL PARA CORRECCIÓN:")
            print("(Revisa cada caso antes de ejecutar)")
            print()
            
            estados_invalidos_unicos = set([op.estado for op in oportunidades_invalidas])
            for estado_invalido in sorted(estados_invalidos_unicos):
                ids_afectadas = [str(op.id) for op in oportunidades_invalidas if op.estado == estado_invalido]
                
                print(f"-- Para estado '{estado_invalido}' (IDs: {', '.join(ids_afectadas)})")
                
                # Sugerir estado correcto basado en el nombre
                estado_sugerido = None
                if "visita" in estado_invalido.lower():
                    estado_sugerido = EstadoOportunidad.VISITA.value
                elif "cotiza" in estado_invalido.lower():
                    estado_sugerido = EstadoOportunidad.COTIZA.value
                elif "abierta" in estado_invalido.lower():
                    estado_sugerido = EstadoOportunidad.ABIERTA.value
                elif "prospect" in estado_invalido.lower():
                    estado_sugerido = EstadoOportunidad.PROSPECT.value
                elif "ganada" in estado_invalido.lower():
                    estado_sugerido = EstadoOportunidad.GANADA.value
                elif "perdida" in estado_invalido.lower():
                    estado_sugerido = EstadoOportunidad.PERDIDA.value
                elif "reserva" in estado_invalido.lower():
                    estado_sugerido = EstadoOportunidad.RESERVA.value
                else:
                    estado_sugerido = EstadoOportunidad.ABIERTA.value  # default
                
                print(f"UPDATE crm_oportunidades SET estado = '{estado_sugerido}' WHERE id IN ({', '.join(ids_afectadas)});")
                print()


if __name__ == "__main__":
    check_invalid_estados()