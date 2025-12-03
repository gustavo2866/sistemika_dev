import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.db import engine
from app.models.crm_evento import CRMEvento
from app.models.crm_oportunidad import CRMOportunidad
import random

def generar_eventos():
    with Session(engine) as session:
        # Obtener oportunidades existentes
        statement = select(CRMOportunidad).limit(30)
        oportunidades = session.exec(statement).all()
        
        if not oportunidades:
            print("No hay oportunidades disponibles")
            return
        
        # Obtener usuarios (asumiendo que hay usuarios con IDs 1-5)
        usuarios_ids = [1, 3, 4]
        
        # Tipos de eventos disponibles
        tipos_evento = ["llamada", "reunion", "visita", "email", "whatsapp", "nota"]
        
        # Estados de eventos
        estados = ["1-pendiente", "2-realizado", "3-cancelado"]
        
        hoy = datetime.now().date()
        
        eventos_crear = []
        
        # Generar 10 eventos para hoy
        print("\nGenerando eventos para HOY:")
        for i in range(10):
            oportunidad = random.choice(oportunidades)
            tipo = random.choice(tipos_evento)
            usuario_id = random.choice(usuarios_ids)
            estado = random.choice(estados)
            
            # Variar la hora del día
            hora_random = random.randint(8, 18)
            fecha_evento = datetime.combine(hoy, datetime.min.time()).replace(hour=hora_random)
            
            titulo = f"{tipo.capitalize()} con cliente - Seguimiento"
            if tipo == "llamada":
                descripcion = "Realizar llamada de seguimiento para evaluar avance del interés y confirmar disponibilidad para próxima visita"
            elif tipo == "reunion":
                descripcion = "Reunión presencial para discutir detalles de la propuesta y condiciones de pago"
            elif tipo == "visita":
                descripcion = "Visita a la propiedad para mostrar características y resolver dudas del cliente"
            elif tipo == "email":
                descripcion = "Enviar email con documentación solicitada y detalles adicionales de la propiedad"
            elif tipo == "whatsapp":
                descripcion = "Seguimiento por WhatsApp para confirmar interés y coordinar próximos pasos"
            else:
                descripcion = "Nota interna sobre el estado de la negociación y próximas acciones a realizar"
            
            resultado = None
            if estado == "2-realizado":
                resultado = "Cliente muestra interés. Seguir con el proceso."
            elif estado == "3-cancelado":
                resultado = "Cliente no disponible. Reprogramar."
            
            evento = CRMEvento(
                oportunidad_id=oportunidad.id,
                titulo=titulo,
                descripcion=descripcion,
                tipo_evento=tipo,
                fecha_evento=fecha_evento,
                estado_evento=estado,
                asignado_a_id=usuario_id,
                resultado=resultado
            )
            eventos_crear.append(evento)
            print(f"  {i+1}. {titulo} - {tipo} - {fecha_evento.strftime('%Y-%m-%d %H:%M')} - {estado}")
        
        # Generar 15 eventos atrasados (últimos 7 días)
        print("\nGenerando eventos ATRASADOS:")
        for i in range(15):
            oportunidad = random.choice(oportunidades)
            tipo = random.choice(tipos_evento)
            usuario_id = random.choice(usuarios_ids)
            
            # Solo eventos pendientes están atrasados
            estado = "1-pendiente"
            
            # Fecha entre 1 y 7 días atrás
            dias_atras = random.randint(1, 7)
            hora_random = random.randint(8, 18)
            fecha_atrasada = hoy - timedelta(days=dias_atras)
            fecha_evento = datetime.combine(fecha_atrasada, datetime.min.time()).replace(hour=hora_random)
            
            titulo = f"ATRASADO: {tipo.capitalize()} pendiente"
            if tipo == "llamada":
                descripcion = "Llamada de seguimiento urgente que no se realizó en la fecha programada"
            elif tipo == "reunion":
                descripcion = "Reunión pendiente que debe ser reprogramada con el cliente"
            elif tipo == "visita":
                descripcion = "Visita a propiedad que no se concretó y requiere coordinación"
            elif tipo == "email":
                descripcion = "Email pendiente de envío con información solicitada por el cliente"
            elif tipo == "whatsapp":
                descripcion = "Mensaje de WhatsApp sin enviar con actualización para el cliente"
            else:
                descripcion = "Nota pendiente que debe ser completada con información de la gestión"
            
            evento = CRMEvento(
                oportunidad_id=oportunidad.id,
                titulo=titulo,
                descripcion=descripcion,
                tipo_evento=tipo,
                fecha_evento=fecha_evento,
                estado_evento=estado,
                asignado_a_id=usuario_id,
                resultado=None
            )
            eventos_crear.append(evento)
            print(f"  {i+1}. {titulo} - {fecha_evento.strftime('%Y-%m-%d')} ({dias_atras} días atrás)")
        
        # Guardar todos los eventos
        for evento in eventos_crear:
            session.add(evento)
        
        session.commit()
        
        print(f"\n✅ {len(eventos_crear)} eventos creados exitosamente")
        print(f"   - 10 eventos para hoy ({hoy.strftime('%Y-%m-%d')})")
        print(f"   - 15 eventos atrasados (últimos 7 días)")

if __name__ == "__main__":
    generar_eventos()
