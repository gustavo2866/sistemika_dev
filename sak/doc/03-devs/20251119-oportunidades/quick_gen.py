"""
Script rápido para generar más datos cuando sea necesario
Ejecutar múltiples veces para acumular datos
"""
import sys
import os
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

from sqlmodel import Session, select
from app.db import engine
from app.models import *
from datetime import datetime, timedelta, UTC
from decimal import Decimal
import random

def quick_gen():
    session = Session(engine)
    
    contactos = session.exec(select(CRMContacto)).all()
    propiedades = session.exec(select(Propiedad).where(Propiedad.estado == "3-disponible")).all()
    tipos_op = session.exec(select(CRMTipoOperacion)).all()
    tipos_evento = session.exec(select(CRMTipoEvento)).all()
    motivos = session.exec(select(CRMMotivoEvento)).all()
    origenes = session.exec(select(CRMOrigenLead)).all()
    
    hoy = datetime.now(UTC)
    
    print("\nGenerando 20 oportunidades...")
    opps_creadas = 0
    for _ in range(20):
        try:
            dias = random.randint(0, 180)
            fecha = hoy - timedelta(days=dias)
            estado = random.choice(["1-abierta", "2-visita", "2-visita", "3-cotiza", "4-reserva", "5-ganada", "6-perdida"])
            tipo = random.choice(tipos_op)
            
            props_filtradas = [p for p in propiedades if p.tipo_operacion_id == tipo.id]
            prop = random.choice(props_filtradas if props_filtradas else propiedades)
            
            prob = {"1-abierta": 15, "2-visita": 35, "3-cotiza": 55, "4-reserva": 80, "5-ganada": 100, "6-perdida": 0}
            
            opp = CRMOportunidad(
                contacto_id=random.choice(contactos).id,
                tipo_operacion_id=tipo.id,
                propiedad_id=prop.id,
                estado=estado,
                fecha_estado=fecha,
                probabilidad=prob.get(estado, 50),
                moneda_id=prop.precio_moneda_id or 1,
                origen_lead_id=random.choice(origenes).id if origenes else None,
                responsable_id=1,
                descripcion_estado=f"Oportunidad automática"
            )
            
            if estado in ["4-reserva", "5-ganada"]:
                opp.monto = prop.precio_venta_estimado or Decimal("100000")
                opp.condicion_pago_id = 1
            
            session.add(opp)
            session.flush()
            opps_creadas += 1
        except:
            session.rollback()
    
    if opps_creadas > 0:
        session.commit()
    print(f"✅ {opps_creadas} oportunidades")
    
    print("\nGenerando 30 eventos...")
    eventos_creados = 0
    oportunidades = session.exec(select(CRMOportunidad)).all()
    tipo_ids = [t.id for t in tipos_evento]
    
    for _ in range(30):
        try:
            dias = random.randint(0, 180)
            fecha = hoy - timedelta(days=dias)
            
            evento = CRMEvento(
                tipo_id=random.choice(tipo_ids),
                contacto_id=random.choice(contactos).id,
                oportunidad_id=random.choice(oportunidades).id if oportunidades and random.random() > 0.2 else None,
                fecha_evento=fecha,
                descripcion=random.choice([
                    "Llamada de seguimiento",
                    "Reunión presencial",
                    "Envío de documentación",
                    "Visita a propiedad",
                    "WhatsApp - consulta",
                    "Email con cotización"
                ]),
                motivo_id=random.choice(motivos).id,
                asignado_a_id=1
            )
            
            session.add(evento)
            session.flush()
            eventos_creados += 1
        except:
            session.rollback()
    
    if eventos_creados > 0:
        session.commit()
    print(f"✅ {eventos_creados} eventos")
    
    # Resumen
    total_opps = len(session.exec(select(CRMOportunidad)).all())
    total_eventos = len(session.exec(select(CRMEvento)).all())
    
    print(f"\n📊 TOTALES:")
    print(f"   Oportunidades: {total_opps}")
    print(f"   Eventos: {total_eventos}")
    
    session.close()

if __name__ == "__main__":
    print("="*60)
    print("GENERACIÓN RÁPIDA DE DATOS")
    print("="*60)
    quick_gen()
    print("="*60)
    print("✅ COMPLETADO")
    print("="*60)
