import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad
import random

# Descripciones realistas según el tipo de operación
DESCRIPCIONES_VENTA = [
    "Cliente interesado en adquirir propiedad para inversión",
    "Búsqueda de departamento para vivienda familiar",
    "Inversión en propiedad comercial en zona céntrica",
    "Compra de terreno para construcción futura",
    "Adquisición de local comercial en desarrollo",
    "Interés en propiedad con financiamiento bancario",
    "Búsqueda de casa en barrio residencial",
    "Inversión en departamento para renta",
    "Compra de oficina para sede empresarial",
    "Adquisición de terreno urbano para proyecto inmobiliario",
    "Cliente busca propiedad cerca de zona universitaria",
    "Interés en casa con jardín y garage",
    "Compra de departamento de 2 dormitorios",
    "Inversión en propiedad turística",
    "Adquisición de local en plaza comercial",
]

DESCRIPCIONES_ALQUILER = [
    "Cliente busca departamento en alquiler temporal",
    "Búsqueda de casa para alquiler anual",
    "Interés en oficina comercial para empresa nueva",
    "Alquiler de local comercial en zona de alto tráfico",
    "Búsqueda de departamento amueblado",
    "Cliente requiere espacio de trabajo compartido",
    "Alquiler de bodega para almacenamiento",
    "Interés en casa con opción a compra",
    "Búsqueda de departamento cerca del trabajo",
    "Alquiler de local para emprendimiento gastronómico",
    "Cliente busca propiedad temporal por reubicación laboral",
    "Interés en departamento con servicios incluidos",
    "Alquiler de oficina virtual",
    "Búsqueda de espacio comercial en centro histórico",
    "Cliente requiere vivienda por estudios universitarios",
]

DESCRIPCIONES_GENERICAS = [
    "Contacto inicial con el cliente",
    "Cliente evaluando opciones disponibles",
    "Seguimiento a consulta de cliente potencial",
    "Interés general en propiedades del catálogo",
    "Cliente requiere asesoría inmobiliaria",
    "Consulta sobre disponibilidad de propiedades",
    "Cliente en proceso de evaluación financiera",
    "Seguimiento a prospecto calificado",
    "Cliente comparando opciones del mercado",
    "Interés en conocer el portafolio disponible",
]

def asignar_descripciones():
    with Session(engine) as session:
        # Obtener oportunidades sin descripción
        statement = select(CRMOportunidad).where(CRMOportunidad.descripcion == None)
        oportunidades = session.exec(statement).all()
        
        print(f"Oportunidades sin descripción: {len(oportunidades)}")
        
        actualizadas = 0
        for opp in oportunidades:
            # Determinar qué lista de descripciones usar basado en tipo_operacion_id
            if opp.tipo_operacion_id == 1:  # Venta
                descripcion = random.choice(DESCRIPCIONES_VENTA)
            elif opp.tipo_operacion_id == 2:  # Alquiler
                descripcion = random.choice(DESCRIPCIONES_ALQUILER)
            else:
                descripcion = random.choice(DESCRIPCIONES_GENERICAS)
            
            opp.descripcion = descripcion
            actualizadas += 1
        
        session.commit()
        print(f"✅ {actualizadas} oportunidades actualizadas con descripciones")
        
        # Verificar
        statement_check = select(CRMOportunidad).where(CRMOportunidad.descripcion == None)
        restantes = len(session.exec(statement_check).all())
        print(f"Oportunidades sin descripción restantes: {restantes}")

if __name__ == "__main__":
    asignar_descripciones()
