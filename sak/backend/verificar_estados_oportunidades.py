#!/usr/bin/env python3
"""
Script para verificar qué estados existen en las oportunidades
"""

import os
import sys

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select, func
from app.db import get_session
from app.models.crm.oportunidad import CRMOportunidad


def verificar_estados_oportunidades():
    """Verifica qué estados existen en las oportunidades"""
    
    with next(get_session()) as session:
        print("🔍 Verificando estados de oportunidades...")
        
        # Estados distintos con conteo
        stmt = (
            select(
                CRMOportunidad.estado,
                func.count(CRMOportunidad.id).label("cantidad")
            )
            .where(CRMOportunidad.activo == True)
            .group_by(CRMOportunidad.estado)
            .order_by(func.count(CRMOportunidad.id).desc())
        )
        
        resultados = session.exec(stmt).all()
        
        print("📊 Estados encontrados:")
        total = 0
        for row in resultados:
            estado = row.estado if row.estado else "NULL"
            print(f"   • {estado}: {row.cantidad} oportunidades")
            total += row.cantidad
        
        print(f"\n📈 Total oportunidades activas: {total}")
        
        # Verificar cuáles tienen mensajes por estado
        print(f"\n🔍 Verificando mensajes por estado...")
        
        for row in resultados:
            estado = row.estado
            
            # Contar oportunidades con mensajes para este estado
            from app.models.crm.mensaje import CRMMensaje
            
            stmt_con_mensajes = (
                select(func.count(func.distinct(CRMOportunidad.id)))
                .select_from(CRMOportunidad)
                .join(CRMMensaje, CRMOportunidad.id == CRMMensaje.oportunidad_id)
                .where(
                    CRMOportunidad.estado == estado,
                    CRMOportunidad.activo == True
                )
            )
            
            con_mensajes = session.exec(stmt_con_mensajes).first()
            sin_mensajes = row.cantidad - con_mensajes
            porcentaje = (con_mensajes / row.cantidad * 100) if row.cantidad > 0 else 0
            
            estado_str = estado if estado else "NULL"
            print(f"   • {estado_str}: {con_mensajes}/{row.cantidad} con mensajes ({porcentaje:.1f}%)")


if __name__ == "__main__":
    verificar_estados_oportunidades()