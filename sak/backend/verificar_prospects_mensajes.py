#!/usr/bin/env python3
"""
Script para verificar cuántas oportunidades en estado 'prospect' tienen mensajes asociados
"""

import os
import sys

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select, func
from app.db import get_session
from app.models.crm.oportunidad import CRMOportunidad
from app.models.crm.mensaje import CRMMensaje


def verificar_prospects_con_mensajes():
    """Verifica cuántas oportunidades en estado 0-prospect tienen mensajes"""
    
    with next(get_session()) as session:
        print("🔍 Verificando oportunidades en estado '0-prospect'...")
        
        # 1. Total de oportunidades en estado 0-prospect
        stmt_total_prospects = select(func.count(CRMOportunidad.id)).where(
            CRMOportunidad.estado == "0-prospect",
            CRMOportunidad.activo == True
        )
        total_prospects = session.exec(stmt_total_prospects).first()
        
        print(f"📊 Total oportunidades en estado '0-prospect': {total_prospects}")
        
        # 2. Prospects con mensajes asociados
        stmt_prospects_con_mensajes = (
            select(func.count(func.distinct(CRMOportunidad.id)))
            .select_from(CRMOportunidad)
            .join(CRMMensaje, CRMOportunidad.id == CRMMensaje.oportunidad_id)
            .where(
                CRMOportunidad.estado == "0-prospect",
                CRMOportunidad.activo == True
            )
        )
        prospects_con_mensajes = session.exec(stmt_prospects_con_mensajes).first()
        
        # 3. Prospects sin mensajes
        prospects_sin_mensajes = total_prospects - prospects_con_mensajes
        
        # 4. Porcentaje
        porcentaje_con_mensajes = (prospects_con_mensajes / total_prospects * 100) if total_prospects > 0 else 0
        
        print(f"✅ Prospects CON mensajes: {prospects_con_mensajes}")
        print(f"❌ Prospects SIN mensajes: {prospects_sin_mensajes}")
        print(f"📈 Porcentaje con mensajes: {porcentaje_con_mensajes:.1f}%")
        
        # 5. Detalles de prospects con mensajes usando ultimo_mensaje_id
        print(f"\n🔍 Verificando campos ultimo_mensaje_* en prospects...")
        
        stmt_ultimo_mensaje = select(func.count(CRMOportunidad.id)).where(
            CRMOportunidad.estado == "0-prospect",
            CRMOportunidad.activo == True,
            CRMOportunidad.ultimo_mensaje_id.isnot(None)
        )
        prospects_con_ultimo_mensaje = session.exec(stmt_ultimo_mensaje).first()
        
        print(f"📝 Prospects con ultimo_mensaje_id: {prospects_con_ultimo_mensaje}")
        
        # 6. Listado detallado de algunos prospects con mensajes (primeros 10)
        if prospects_con_mensajes > 0:
            print(f"\n📋 Primeros 10 prospects con mensajes:")
            stmt_detalles = (
                select(
                    CRMOportunidad.id,
                    CRMOportunidad.titulo,
                    CRMOportunidad.ultimo_mensaje_id,
                    CRMOportunidad.ultimo_mensaje_at,
                    func.count(CRMMensaje.id).label("total_mensajes")
                )
                .select_from(CRMOportunidad)
                .join(CRMMensaje, CRMOportunidad.id == CRMMensaje.oportunidad_id)
                .where(
                    CRMOportunidad.estado == "0-prospect",
                    CRMOportunidad.activo == True
                )
                .group_by(
                    CRMOportunidad.id,
                    CRMOportunidad.titulo,
                    CRMOportunidad.ultimo_mensaje_id,
                    CRMOportunidad.ultimo_mensaje_at
                )
                .order_by(CRMOportunidad.ultimo_mensaje_at.desc().nullslast())
                .limit(10)
            )
            
            resultados = session.exec(stmt_detalles).all()
            
            for row in resultados:
                fecha_str = row.ultimo_mensaje_at.strftime("%Y-%m-%d %H:%M") if row.ultimo_mensaje_at else "Sin fecha"
                titulo = (row.titulo[:50] + "...") if row.titulo else "Sin título"
                print(f"   • ID {row.id}: {titulo} | {row.total_mensajes} mensajes | Último: {fecha_str}")


if __name__ == "__main__":
    verificar_prospects_con_mensajes()