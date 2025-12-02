import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.db import engine
from app.models.crm_evento import CRMEvento
import random

def distribuir_fechas():
    with Session(engine) as session:
        # Obtener todos los eventos
        statement = select(CRMEvento).order_by(CRMEvento.id)
        eventos = session.exec(statement).all()
        
        total = len(eventos)
        print(f"Total de eventos a distribuir: {total}")
        
        if total == 0:
            print("No hay eventos para distribuir")
            return
        
        # Calcular fechas de referencia
        hoy = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Distribuir eventos en diferentes rangos
        # 20% vencidos (días anteriores)
        # 20% hoy
        # 20% esta semana
        # 20% próxima semana
        # 20% futuras (más de 2 semanas)
        
        eventos_por_categoria = total // 5
        resto = total % 5
        
        actualizados = 0
        
        # Vencidos - entre 1 y 15 días atrás
        for i in range(eventos_por_categoria + (1 if resto > 0 else 0)):
            if i < len(eventos):
                dias_atras = random.randint(1, 15)
                hora = random.randint(9, 18)
                minuto = random.randint(0, 59)
                eventos[i].fecha_evento = hoy - timedelta(days=dias_atras) + timedelta(hours=hora, minutes=minuto)
                actualizados += 1
        resto = max(0, resto - 1)
        
        # Hoy - diferentes horas del día
        inicio = eventos_por_categoria
        fin = inicio + eventos_por_categoria + (1 if resto > 0 else 0)
        for i in range(inicio, min(fin, len(eventos))):
            hora = random.randint(9, 18)
            minuto = random.randint(0, 59)
            eventos[i].fecha_evento = hoy + timedelta(hours=hora, minutes=minuto)
            actualizados += 1
        resto = max(0, resto - 1)
        
        # Esta semana - entre mañana y domingo
        inicio = fin
        dia_semana_actual = hoy.weekday()  # 0 = lunes, 6 = domingo
        dias_hasta_domingo = 6 - dia_semana_actual
        fin = inicio + eventos_por_categoria + (1 if resto > 0 else 0)
        for i in range(inicio, min(fin, len(eventos))):
            dias_adelante = random.randint(1, max(1, dias_hasta_domingo))
            hora = random.randint(9, 18)
            minuto = random.randint(0, 59)
            eventos[i].fecha_evento = hoy + timedelta(days=dias_adelante, hours=hora, minutes=minuto)
            actualizados += 1
        resto = max(0, resto - 1)
        
        # Próxima semana - entre lunes y domingo de la próxima semana
        inicio = fin
        fin = inicio + eventos_por_categoria + (1 if resto > 0 else 0)
        dias_al_proximo_lunes = 7 - dia_semana_actual
        for i in range(inicio, min(fin, len(eventos))):
            dias_adelante = dias_al_proximo_lunes + random.randint(0, 6)
            hora = random.randint(9, 18)
            minuto = random.randint(0, 59)
            eventos[i].fecha_evento = hoy + timedelta(days=dias_adelante, hours=hora, minutes=minuto)
            actualizados += 1
        resto = max(0, resto - 1)
        
        # Futuras - más de 2 semanas
        inicio = fin
        for i in range(inicio, len(eventos)):
            dias_adelante = random.randint(15, 60)
            hora = random.randint(9, 18)
            minuto = random.randint(0, 59)
            eventos[i].fecha_evento = hoy + timedelta(days=dias_adelante, hours=hora, minutes=minuto)
            actualizados += 1
        
        session.commit()
        print(f"✅ {actualizados} eventos actualizados con fechas distribuidas")
        
        # Mostrar distribución
        print("\nDistribución de eventos:")
        vencidos = sum(1 for e in eventos if e.fecha_evento < hoy)
        hoy_eventos = sum(1 for e in eventos if e.fecha_evento.date() == hoy.date())
        
        # Esta semana (desde mañana hasta domingo)
        manana = hoy + timedelta(days=1)
        fin_semana = hoy + timedelta(days=(6 - dia_semana_actual))
        esta_semana = sum(1 for e in eventos if manana <= e.fecha_evento <= fin_semana + timedelta(hours=23, minutes=59, seconds=59))
        
        # Próxima semana
        inicio_proxima = hoy + timedelta(days=(7 - dia_semana_actual))
        fin_proxima = inicio_proxima + timedelta(days=6, hours=23, minutes=59, seconds=59)
        proxima_semana = sum(1 for e in eventos if inicio_proxima <= e.fecha_evento <= fin_proxima)
        
        # Futuras (después de próxima semana)
        futuras = sum(1 for e in eventos if e.fecha_evento > fin_proxima)
        
        print(f"  Vencidas: {vencidos}")
        print(f"  Hoy: {hoy_eventos}")
        print(f"  Esta semana: {esta_semana}")
        print(f"  Próxima semana: {proxima_semana}")
        print(f"  Futuras: {futuras}")

if __name__ == "__main__":
    distribuir_fechas()
