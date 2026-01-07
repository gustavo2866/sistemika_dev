"""
Reporte detallado de oportunidades con estados inválidos
"""
from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad
from app.models.enums import EstadoOportunidad


def generate_detailed_report():
    """Genera un reporte detallado de las oportunidades con estados inválidos."""
    
    with Session(engine) as session:
        # Estados válidos
        estados_validos = [estado.value for estado in EstadoOportunidad]
        
        # Consultar oportunidades con estados inválidos incluyendo más detalles
        result = session.exec(
            select(
                CRMOportunidad.id, 
                CRMOportunidad.titulo, 
                CRMOportunidad.estado, 
                CRMOportunidad.activo,
                CRMOportunidad.fecha_estado,
                CRMOportunidad.created_at,
                CRMOportunidad.responsable_id,
                CRMOportunidad.contacto_id
            )
            .where(CRMOportunidad.estado.notin_(estados_validos))
            .order_by(CRMOportunidad.estado, CRMOportunidad.id)
        )
        
        oportunidades = result.all()
        
        print("📋 REPORTE DETALLADO - OPORTUNIDADES CON ESTADOS INVÁLIDOS")
        print("=" * 100)
        print(f"Fecha del reporte: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Total encontradas: {len(oportunidades)}")
        print()
        
        # Agrupar por estado inválido
        from collections import defaultdict
        grupos = defaultdict(list)
        
        for op in oportunidades:
            grupos[op.estado].append(op)
        
        for estado_invalido in sorted(grupos.keys()):
            ops = grupos[estado_invalido]
            print(f"🚨 ESTADO INVÁLIDO: '{estado_invalido}' ({len(ops)} oportunidades)")
            print("-" * 80)
            
            # Mostrar detalles de cada oportunidad
            for op in ops:
                activo = "ACTIVA" if op.activo else "INACTIVA"
                titulo = op.titulo or "Sin título"
                fecha_estado = op.fecha_estado.strftime('%Y-%m-%d %H:%M') if op.fecha_estado else "N/A"
                fecha_creacion = op.created_at.strftime('%Y-%m-%d %H:%M') if op.created_at else "N/A"
                
                print(f"  ID: {op.id:4d} | {activo:8s} | Responsable: {op.responsable_id:3d} | Contacto: {op.contacto_id:4d}")
                print(f"         Título: {titulo}")
                print(f"         Fecha estado: {fecha_estado} | Creada: {fecha_creacion}")
                print()
            
            # Sugerencia de corrección
            estado_sugerido = None
            razon = ""
            
            if "contacto" in estado_invalido.lower() and "inicial" in estado_invalido.lower():
                estado_sugerido = EstadoOportunidad.ABIERTA.value
                razon = "Contacto inicial establecido → etapa abierta"
            elif "visita" in estado_invalido.lower() and "programada" in estado_invalido.lower():
                estado_sugerido = EstadoOportunidad.VISITA.value  
                razon = "Visita programada → etapa de visita"
            elif "propuesta" in estado_invalido.lower() or "enviada" in estado_invalido.lower():
                estado_sugerido = EstadoOportunidad.COTIZA.value
                razon = "Propuesta enviada → etapa de cotización"
            elif "negociacion" in estado_invalido.lower():
                estado_sugerido = EstadoOportunidad.RESERVA.value
                razon = "En negociación → etapa de reserva"
            elif estado_invalido == "6-ganada":
                estado_sugerido = EstadoOportunidad.GANADA.value
                razon = "Corrección de numeración (6→5)"
            elif estado_invalido == "7-perdida":
                estado_sugerido = EstadoOportunidad.PERDIDA.value
                razon = "Corrección de numeración (7→6)"
            elif estado_invalido == "3":
                estado_sugerido = EstadoOportunidad.COTIZA.value
                razon = "Estado incompleto → cotización (por numeración)"
            else:
                estado_sugerido = EstadoOportunidad.ABIERTA.value
                razon = "Estado por defecto"
            
            print(f"💡 CORRECCIÓN SUGERIDA: {estado_invalido} → {estado_sugerido}")
            print(f"   Razón: {razon}")
            print(f"   SQL: UPDATE crm_oportunidades SET estado = '{estado_sugerido}' WHERE estado = '{estado_invalido}';")
            print()
            print("=" * 100)
        
        # Resumen final
        print("📊 RESUMEN POR ESTADO INVÁLIDO:")
        print("-" * 50)
        for estado in sorted(grupos.keys()):
            count = len(grupos[estado])
            activas = sum(1 for op in grupos[estado] if op.activo)
            print(f"  {estado:25s}: {count:2d} total ({activas} activas, {count-activas} inactivas)")


if __name__ == "__main__":
    generate_detailed_report()