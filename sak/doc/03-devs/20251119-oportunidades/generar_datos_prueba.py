"""
Script para generar datos de prueba con distribución temporal
- Más propiedades variadas
- Más oportunidades distribuidas en el tiempo
- Más eventos con fechas históricas
"""
import sys
import os
import io

# Configurar encoding UTF-8 para Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

from sqlmodel import Session, select
from app.db import engine
from app.models import (
    Emprendimiento, Propiedad, CRMOportunidad, CRMEvento,
    CRMContacto, CRMTipoOperacion, CRMOrigenLead, CRMMotivoEvento,
    CRMTipoEvento, Moneda
)
from datetime import datetime, timedelta, UTC, date
from decimal import Decimal
import random

def generar_propiedades_adicionales():
    """Generar 30 propiedades adicionales variadas"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("1. GENERANDO PROPIEDADES ADICIONALES")
    print("="*80 + "\n")
    
    # Obtener emprendimientos
    emprendimientos = session.exec(select(Emprendimiento)).all()
    
    propiedades_data = [
        # Departamentos para alquiler (10)
        {"nombre": "Depto 2 amb Palermo Soho", "tipo": "departamento", "propietario": "Martinez SA", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("350000"), "precio_moneda_id": 1},
        {"nombre": "Monoambiente Belgrano R", "tipo": "departamento", "propietario": "Gomez Inversiones", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("280000"), "precio_moneda_id": 1},
        {"nombre": "Depto 3 amb Recoleta Premium", "tipo": "departamento", "propietario": "Real Estate Plus", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("550000"), "precio_moneda_id": 1},
        {"nombre": "Loft Palermo Hollywood", "tipo": "departamento", "propietario": "Lopez Propiedades", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("420000"), "precio_moneda_id": 1},
        {"nombre": "Depto 2 amb Villa Crespo", "tipo": "departamento", "propietario": "Fernandez y Hnos", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("320000"), "precio_moneda_id": 1},
        {"nombre": "Monoambiente Caballito", "tipo": "departamento", "propietario": "Ruiz Inmobiliaria", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("250000"), "precio_moneda_id": 1},
        {"nombre": "Depto 4 amb Nuñez Vista Río", "tipo": "departamento", "propietario": "Diaz Propiedades", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("650000"), "precio_moneda_id": 1},
        {"nombre": "Loft San Telmo Con Terraza", "tipo": "departamento", "propietario": "Sanchez Bienes Raíces", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("380000"), "precio_moneda_id": 1},
        {"nombre": "Depto 2 amb Barrio Norte", "tipo": "departamento", "propietario": "Garcia Inversiones", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("400000"), "precio_moneda_id": 1},
        {"nombre": "Monoambiente Puerto Madero", "tipo": "departamento", "propietario": "Rodriguez SA", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("480000"), "precio_moneda_id": 1},
        
        # Oficinas para venta (8)
        {"nombre": "Oficina Microcentro 120m2", "tipo": "oficina", "propietario": "Torres Comerciales SA", 
         "estado": "3-disponible", "tipo_operacion_id": 2, "precio_venta_estimado": Decimal("180000"), "precio_moneda_id": 2},
        {"nombre": "Oficina Catalinas Norte 85m2", "tipo": "oficina", "propietario": "Office Buildings Corp", 
         "estado": "3-disponible", "tipo_operacion_id": 2, "precio_venta_estimado": Decimal("145000"), "precio_moneda_id": 2},
        {"nombre": "Oficina Monserrat 65m2", "tipo": "oficina", "propietario": "Edificios Premium SRL", 
         "estado": "3-disponible", "tipo_operacion_id": 2, "precio_venta_estimado": Decimal("95000"), "precio_moneda_id": 2},
        {"nombre": "Oficina Retiro Torre AAA 200m2", "tipo": "oficina", "propietario": "Corporate Estates", 
         "estado": "3-disponible", "tipo_operacion_id": 2, "precio_venta_estimado": Decimal("320000"), "precio_moneda_id": 2},
        {"nombre": "Oficina San Nicolás 95m2", "tipo": "oficina", "propietario": "Business Center SA", 
         "estado": "3-disponible", "tipo_operacion_id": 2, "precio_venta_estimado": Decimal("125000"), "precio_moneda_id": 2},
        {"nombre": "Oficina Tribunales 75m2", "tipo": "oficina", "propietario": "Legal Buildings", 
         "estado": "3-disponible", "tipo_operacion_id": 2, "precio_venta_estimado": Decimal("105000"), "precio_moneda_id": 2},
        {"nombre": "Oficina Puerto Madero 150m2", "tipo": "oficina", "propietario": "Madero Office Park", 
         "estado": "3-disponible", "tipo_operacion_id": 2, "precio_venta_estimado": Decimal("250000"), "precio_moneda_id": 2},
        {"nombre": "Oficina Corrientes Av 110m2", "tipo": "oficina", "propietario": "Avenida Properties", 
         "estado": "3-disponible", "tipo_operacion_id": 2, "precio_venta_estimado": Decimal("155000"), "precio_moneda_id": 2},
        
        # Locales comerciales (6)
        {"nombre": "Local Av Cabildo 80m2", "tipo": "local", "propietario": "Retail Spaces SA", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("450000"), "precio_moneda_id": 1},
        {"nombre": "Local Palermo Viejo 60m2", "tipo": "local", "propietario": "Commercial Properties", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("380000"), "precio_moneda_id": 1},
        {"nombre": "Local Recoleta Esquina 120m2", "tipo": "local", "propietario": "Prime Locations SRL", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("650000"), "precio_moneda_id": 1},
        {"nombre": "Local San Telmo 55m2", "tipo": "local", "propietario": "Historic District Realty", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("320000"), "precio_moneda_id": 1},
        {"nombre": "Local Caballito Centro 95m2", "tipo": "local", "propietario": "Neighborhood Commerce", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("420000"), "precio_moneda_id": 1},
        {"nombre": "Local Villa Urquiza 70m2", "tipo": "local", "propietario": "Norte Propiedades", 
         "estado": "3-disponible", "tipo_operacion_id": 1, "precio_venta_estimado": Decimal("350000"), "precio_moneda_id": 1},
        
        # Unidades en emprendimientos (6)
        {"nombre": "Torres del Puerto - Torre 3 Piso 8", "tipo": "departamento", "propietario": "Torres del Puerto", 
         "estado": "1-ingresada", "tipo_operacion_id": 3, "emprendimiento_id": emprendimientos[1].id if len(emprendimientos) > 1 else 1,
         "precio_venta_estimado": Decimal("380000"), "precio_moneda_id": 2},
        {"nombre": "Torres del Puerto - Torre 2 Piso 15", "tipo": "departamento", "propietario": "Torres del Puerto", 
         "estado": "1-ingresada", "tipo_operacion_id": 3, "emprendimiento_id": emprendimientos[1].id if len(emprendimientos) > 1 else 1,
         "precio_venta_estimado": Decimal("520000"), "precio_moneda_id": 2},
        {"nombre": "Nordelta BP - Oficina Torre A Piso 7", "tipo": "oficina", "propietario": "Nordelta Business Park", 
         "estado": "1-ingresada", "tipo_operacion_id": 3, "emprendimiento_id": emprendimientos[2].id if len(emprendimientos) > 2 else 1,
         "precio_venta_estimado": Decimal("195000"), "precio_moneda_id": 2},
        {"nombre": "Nordelta BP - Local PB Torre A", "tipo": "local", "propietario": "Nordelta Business Park", 
         "estado": "1-ingresada", "tipo_operacion_id": 3, "emprendimiento_id": emprendimientos[2].id if len(emprendimientos) > 2 else 1,
         "precio_venta_estimado": Decimal("165000"), "precio_moneda_id": 2},
        {"nombre": "Torres del Puerto - Pent-house Torre 1", "tipo": "departamento", "propietario": "Torres del Puerto", 
         "estado": "1-ingresada", "tipo_operacion_id": 3, "emprendimiento_id": emprendimientos[1].id if len(emprendimientos) > 1 else 1,
         "precio_venta_estimado": Decimal("850000"), "precio_moneda_id": 2},
        {"nombre": "Nordelta BP - Oficina Torre B Piso 6", "tipo": "oficina", "propietario": "Nordelta Business Park", 
         "estado": "1-ingresada", "tipo_operacion_id": 3, "emprendimiento_id": emprendimientos[2].id if len(emprendimientos) > 2 else 1,
         "precio_venta_estimado": Decimal("175000"), "precio_moneda_id": 2},
    ]
    
    creadas = 0
    for prop_data in propiedades_data:
        try:
            # Verificar si ya existe
            existing = session.exec(
                select(Propiedad).where(Propiedad.nombre == prop_data["nombre"])
            ).first()
            
            if existing:
                print(f"⚠️  Ya existe: {prop_data['nombre']}")
                continue
            
            propiedad = Propiedad(**prop_data)
            session.add(propiedad)
            session.flush()
            creadas += 1
            
            tipo_op = {1: "Alquiler", 2: "Venta", 3: "Emprendimiento"}.get(prop_data["tipo_operacion_id"], "?")
            print(f"✅ {propiedad.nombre} | {tipo_op} | ${propiedad.precio_venta_estimado}")
        except Exception as e:
            print(f"❌ Error: {prop_data['nombre']} - {e}")
            session.rollback()
    
    if creadas > 0:
        session.commit()
        print(f"\n✅ {creadas} propiedades creadas")
    else:
        print(f"\n⚠️  No se crearon propiedades nuevas")
    
    session.close()
    return creadas

def generar_oportunidades_temporales():
    """Generar 40 oportunidades distribuidas en los últimos 6 meses"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("2. GENERANDO OPORTUNIDADES CON DISTRIBUCIÓN TEMPORAL")
    print("="*80 + "\n")
    
    # Obtener datos base
    contactos = session.exec(select(CRMContacto)).all()
    propiedades = session.exec(select(Propiedad).where(Propiedad.estado == "3-disponible")).all()
    tipos_operacion = session.exec(select(CRMTipoOperacion)).all()
    origenes = session.exec(select(CRMOrigenLead)).all()
    
    if not contactos or not propiedades:
        print("❌ Faltan datos base")
        session.close()
        return 0
    
    # Fecha base: hoy
    hoy = datetime.now(UTC)
    
    # Distribuir oportunidades en 6 meses (180 días)
    oportunidades_config = []
    
    # Enero-Febrero (hace 4-6 meses) - 10 oportunidades
    for _ in range(10):
        dias_atras = random.randint(120, 180)
        fecha = hoy - timedelta(days=dias_atras)
        estado = random.choice(["5-ganada", "5-ganada", "6-perdida", "6-perdida", "4-reserva"])
        oportunidades_config.append({"fecha": fecha, "estado": estado, "periodo": "Ene-Feb"})
    
    # Marzo-Abril (hace 2-4 meses) - 12 oportunidades
    for _ in range(12):
        dias_atras = random.randint(60, 120)
        fecha = hoy - timedelta(days=dias_atras)
        estado = random.choice(["5-ganada", "6-perdida", "4-reserva", "3-cotiza"])
        oportunidades_config.append({"fecha": fecha, "estado": estado, "periodo": "Mar-Abr"})
    
    # Mayo-Octubre (hace 0-2 meses) - 18 oportunidades más activas
    for _ in range(18):
        dias_atras = random.randint(0, 60)
        fecha = hoy - timedelta(days=dias_atras)
        estado = random.choice(["1-abierta", "2-visita", "3-cotiza", "4-reserva", "1-abierta", "2-visita"])
        oportunidades_config.append({"fecha": fecha, "estado": estado, "periodo": "May-Nov"})
    
    creadas = 0
    for config in oportunidades_config:
        try:
            # Seleccionar tipo de operación
            tipo_op = random.choice(tipos_operacion)
            
            # Filtrar propiedades por tipo de operación
            props_filtradas = [p for p in propiedades if p.tipo_operacion_id == tipo_op.id]
            if not props_filtradas:
                props_filtradas = propiedades
            
            propiedad = random.choice(props_filtradas)
            contacto = random.choice(contactos)
            
            # Calcular probabilidad según estado
            probabilidades = {
                "1-abierta": random.randint(10, 20),
                "2-visita": random.randint(25, 40),
                "3-cotiza": random.randint(45, 65),
                "4-reserva": random.randint(75, 90),
                "5-ganada": 100,
                "6-perdida": 0
            }
            
            # Datos de la oportunidad
            opp_data = {
                "contacto_id": contacto.id,
                "tipo_operacion_id": tipo_op.id,
                "propiedad_id": propiedad.id,
                "estado": config["estado"],
                "fecha_estado": config["fecha"],
                "probabilidad": probabilidades.get(config["estado"], 50),
                "moneda_id": propiedad.precio_moneda_id or 1,
                "origen_lead_id": random.choice(origenes).id if origenes else None,
                "responsable_id": 1,
                "descripcion_estado": f"Oportunidad generada - {config['periodo']}"
            }
            
            # Agregar monto para estados avanzados
            if config["estado"] in ["4-reserva", "5-ganada"]:
                opp_data["monto"] = propiedad.precio_venta_estimado or Decimal("100000")
                opp_data["condicion_pago_id"] = 1
            
            oportunidad = CRMOportunidad(**opp_data)
            session.add(oportunidad)
            session.flush()
            
            creadas += 1
            if creadas <= 10:
                print(f"✅ Opp {oportunidad.id} | {tipo_op.nombre} | {config['estado']} | {config['fecha'].strftime('%Y-%m-%d')}")
        
        except Exception as e:
            print(f"❌ Error creando oportunidad: {e}")
            session.rollback()
    
    if creadas > 0:
        print(f"   ... y {creadas - 10} más" if creadas > 10 else "")
        session.commit()
        print(f"\n✅ {creadas} oportunidades creadas")
    
    session.close()
    return creadas

def generar_eventos_temporales():
    """Generar 60 eventos distribuidos temporalmente"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("3. GENERANDO EVENTOS CON DISTRIBUCIÓN TEMPORAL")
    print("="*80 + "\n")
    
    contactos = session.exec(select(CRMContacto)).all()
    oportunidades = session.exec(select(CRMOportunidad)).all()
    tipos_evento = session.exec(select(CRMTipoEvento)).all()
    motivos = session.exec(select(CRMMotivoEvento)).all()
    
    if not contactos or not tipos_evento or not motivos:
        print("❌ Faltan datos base")
        session.close()
        return 0
    
    # Crear mapeo de tipos
    tipo_map = {tipo.nombre.lower(): tipo.id for tipo in tipos_evento}
    tipo_ids = list(tipo_map.values())
    
    hoy = datetime.now(UTC)
    
    # Plantillas de descripciones
    descripciones = {
        "llamada": [
            "Llamada de seguimiento - cliente interesado",
            "Primera llamada - consulta inicial",
            "Llamada para coordinar visita",
            "Seguimiento post-visita",
            "Llamada de cierre - negociación",
            "Contacto telefónico - aclaración de dudas"
        ],
        "email": [
            "Envío de cotización detallada",
            "Envío de documentación de propiedad",
            "Email de seguimiento",
            "Envío de contrato borrador",
            "Respuesta a consultas",
            "Email con nueva información"
        ],
        "reunion": [
            "Reunión en oficina",
            "Reunión de presentación",
            "Reunión de cierre",
            "Reunión de seguimiento",
            "Reunión con decisores"
        ],
        "visita": [
            "Visita a la propiedad",
            "Segunda visita con familia",
            "Visita a showroom",
            "Recorrida completa",
            "Visita técnica"
        ]
    }
    
    eventos_config = []
    
    # Últimos 6 meses - 60 eventos
    for _ in range(60):
        dias_atras = random.randint(0, 180)
        fecha = hoy - timedelta(days=dias_atras)
        tipo_nombre = random.choice(["llamada", "email", "reunion", "visita", "whatsapp"])
        
        eventos_config.append({
            "fecha": fecha,
            "tipo_nombre": tipo_nombre,
            "descripcion": random.choice(descripciones.get(tipo_nombre, ["Evento registrado"]))
        })
    
    creadas = 0
    for config in eventos_config:
        try:
            tipo_id = tipo_map.get(config["tipo_nombre"], tipo_ids[0] if tipo_ids else 1)
            
            evento_data = {
                "tipo_id": tipo_id,
                "contacto_id": random.choice(contactos).id,
                "oportunidad_id": random.choice(oportunidades).id if oportunidades and random.random() > 0.3 else None,
                "fecha_evento": config["fecha"],
                "descripcion": config["descripcion"],
                "motivo_id": random.choice(motivos).id,
                "asignado_a_id": 1
            }
            
            evento = CRMEvento(**evento_data)
            session.add(evento)
            session.flush()
            
            creadas += 1
            if creadas <= 10:
                tipo_nombre = next((t.nombre for t in tipos_evento if t.id == tipo_id), "?")
                print(f"✅ Evento {evento.id} | {tipo_nombre} | {config['fecha'].strftime('%Y-%m-%d')}")
        
        except Exception as e:
            print(f"❌ Error: {e}")
            session.rollback()
    
    if creadas > 0:
        print(f"   ... y {creadas - 10} más" if creadas > 10 else "")
        session.commit()
        print(f"\n✅ {creadas} eventos creados")
    
    session.close()
    return creadas

def mostrar_resumen_final():
    """Mostrar resumen de todos los datos"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("RESUMEN FINAL DE DATOS")
    print("="*80 + "\n")
    
    # Propiedades
    propiedades = session.exec(select(Propiedad)).all()
    print(f"📊 PROPIEDADES: {len(propiedades)} totales")
    por_tipo_op = {}
    for p in propiedades:
        tipo = {1: "Alquiler", 2: "Venta", 3: "Emprendimiento"}.get(p.tipo_operacion_id, "Sin tipo")
        por_tipo_op[tipo] = por_tipo_op.get(tipo, 0) + 1
    for tipo, count in sorted(por_tipo_op.items()):
        print(f"   {tipo}: {count}")
    
    # Oportunidades
    oportunidades = session.exec(select(CRMOportunidad)).all()
    print(f"\n📊 OPORTUNIDADES: {len(oportunidades)} totales")
    
    # Por estado
    por_estado = {}
    for o in oportunidades:
        por_estado[o.estado] = por_estado.get(o.estado, 0) + 1
    for estado, count in sorted(por_estado.items()):
        print(f"   {estado}: {count}")
    
    # Por periodo (últimos 6 meses)
    hoy = datetime.now(UTC)
    periodos = {
        "Este mes": 0,
        "Mes pasado": 0,
        "Hace 2-3 meses": 0,
        "Hace 4-6 meses": 0
    }
    
    for o in oportunidades:
        if o.fecha_estado:
            # Asegurar que ambas fechas sean aware o naive
            fecha_opp = o.fecha_estado
            if not fecha_opp.tzinfo:
                fecha_opp = fecha_opp.replace(tzinfo=UTC)
            
            dias = (hoy - fecha_opp).days
            if dias <= 30:
                periodos["Este mes"] += 1
            elif dias <= 60:
                periodos["Mes pasado"] += 1
            elif dias <= 120:
                periodos["Hace 2-3 meses"] += 1
            else:
                periodos["Hace 4-6 meses"] += 1
    
    print(f"\n📅 Distribución temporal:")
    for periodo, count in periodos.items():
        print(f"   {periodo}: {count}")
    
    # Eventos
    eventos = session.exec(select(CRMEvento)).all()
    print(f"\n📊 EVENTOS: {len(eventos)} totales")
    
    # Por tipo
    por_tipo_evento = {}
    for e in eventos:
        tipo_nombre = e.tipo.nombre if e.tipo else "Sin tipo"
        por_tipo_evento[tipo_nombre] = por_tipo_evento.get(tipo_nombre, 0) + 1
    for tipo, count in sorted(por_tipo_evento.items()):
        print(f"   {tipo}: {count}")
    
    session.close()

if __name__ == "__main__":
    print("\n" + "="*80)
    print("GENERACIÓN DE DATOS DE PRUEBA")
    print("="*80)
    
    try:
        # 1. Propiedades
        props = generar_propiedades_adicionales()
        
        # 2. Oportunidades
        opps = generar_oportunidades_temporales()
        
        # 3. Eventos
        eventos = generar_eventos_temporales()
        
        # 4. Resumen
        mostrar_resumen_final()
        
        print("\n" + "="*80)
        print("✅ GENERACIÓN COMPLETADA")
        print(f"   Propiedades: +{props}")
        print(f"   Oportunidades: +{opps}")
        print(f"   Eventos: +{eventos}")
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
