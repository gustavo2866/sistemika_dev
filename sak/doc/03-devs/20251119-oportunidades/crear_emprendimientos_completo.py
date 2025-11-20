"""
Script completo para crear emprendimientos y datos CRM consistentes
1. Crear 2 emprendimientos nuevos
2. Asignar propiedades tipo terreno a emprendimientos
3. Crear propiedades adicionales para emprendimientos
4. Crear oportunidades variadas (Alquiler, Venta, Emprendimiento)
5. Crear eventos CRM
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
from datetime import datetime, timedelta, UTC
from decimal import Decimal
import random

def crear_emprendimientos():
    """Crear 2 emprendimientos nuevos"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("1. CREANDO EMPRENDIMIENTOS")
    print("="*80 + "\n")
    
    emprendimientos_data = [
        {
            "nombre": "Torres del Puerto",
            "descripcion": "Complejo de torres residenciales premium en Puerto Madero con amenities de lujo: gym, spa, piscina, coworking y seguridad 24hs. 180 unidades en total, 95 disponibles. Precio desde USD 280.000. Entrega Q4 2026. Desarrollador: Desarrollos Urbanos SA. Contacto: +54 11 4567-8900 | ventas@torresdelpuerto.com.ar",
            "ubicacion": "Puerto Madero, CABA",
            "estado": "2-construccion",
            "fecha_inicio": datetime(2024, 3, 1).date(),
            "fecha_fin_estimada": datetime(2026, 12, 31).date(),
            "responsable_id": 1
        },
        {
            "nombre": "Nordelta Business Park",
            "descripcion": "Parque empresarial sustentable con oficinas AAA, locales comerciales y espacios verdes. Ideal para empresas tecnológicas. 45 unidades disponibles. Precio desde USD 150.000. Certificación LEED. Entrega 2027. Desarrollador: Green Developments Corp. Contacto: +54 11 5678-9100 | info@nordeltabp.com",
            "ubicacion": "Nordelta, Tigre, Buenos Aires",
            "estado": "1-planificacion",
            "fecha_inicio": datetime(2025, 6, 1).date(),
            "fecha_fin_estimada": datetime(2027, 8, 30).date(),
            "responsable_id": 1
        }
    ]
    
    emprendimientos_creados = []
    for emp_data in emprendimientos_data:
        # Verificar si ya existe
        existing = session.exec(
            select(Emprendimiento).where(Emprendimiento.nombre == emp_data["nombre"])
        ).first()
        
        if existing:
            print(f"⚠️  Emprendimiento '{emp_data['nombre']}' ya existe (ID: {existing.id})")
            emprendimientos_creados.append(existing)
        else:
            emprendimiento = Emprendimiento(**emp_data)
            session.add(emprendimiento)
            session.flush()  # Para obtener el ID
            emprendimientos_creados.append(emprendimiento)
            print(f"✅ Emprendimiento creado: {emprendimiento.nombre} (ID: {emprendimiento.id})")
            print(f"   Ubicación: {emprendimiento.ubicacion}")
            print(f"   Estado: {emprendimiento.estado}")
    
    session.commit()
    session.close()
    
    return emprendimientos_creados

def asignar_terrenos_a_emprendimientos():
    """Asignar propiedades tipo terreno a emprendimientos"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("2. ASIGNANDO TERRENOS A EMPRENDIMIENTOS")
    print("="*80 + "\n")
    
    # Buscar terrenos
    terrenos = session.exec(
        select(Propiedad).where(Propiedad.tipo == "terreno")
    ).all()
    
    print(f"Terrenos encontrados: {len(terrenos)}")
    
    if len(terrenos) == 0:
        print("⚠️  No hay terrenos para asignar")
        session.close()
        return
    
    # Obtener emprendimientos
    emprendimientos = session.exec(select(Emprendimiento)).all()
    
    if len(emprendimientos) == 0:
        print("❌ No hay emprendimientos disponibles")
        session.close()
        return
    
    # Obtener tipo de operación "Emprendimiento" (ID 3)
    tipo_emprendimiento = session.exec(
        select(CRMTipoOperacion).where(CRMTipoOperacion.id == 3)
    ).first()
    
    if not tipo_emprendimiento:
        print("❌ Tipo de operación 'Emprendimiento' no existe")
        session.close()
        return
    
    asignados = 0
    for terreno in terrenos:
        # Asignar aleatoriamente a un emprendimiento
        emprendimiento = random.choice(emprendimientos)
        
        terreno.emprendimiento_id = emprendimiento.id
        terreno.tipo_operacion_id = tipo_emprendimiento.id
        
        # Si no tiene precio, asignar uno
        if not terreno.precio_venta_estimado:
            terreno.precio_venta_estimado = Decimal(random.randint(80000, 300000))
            terreno.precio_moneda_id = 2  # USD
        
        session.add(terreno)
        asignados += 1
        print(f"✅ Terreno '{terreno.nombre}' → Emprendimiento '{emprendimiento.nombre}'")
        print(f"   Tipo operación: {tipo_emprendimiento.nombre}")
    
    session.commit()
    print(f"\n✅ {asignados} terrenos asignados a emprendimientos")
    session.close()

def crear_propiedades_emprendimientos():
    """Crear propiedades adicionales para emprendimientos"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("3. CREANDO PROPIEDADES PARA EMPRENDIMIENTOS")
    print("="*80 + "\n")
    
    emprendimientos = session.exec(select(Emprendimiento)).all()
    
    if len(emprendimientos) == 0:
        print("❌ No hay emprendimientos")
        session.close()
        return
    
    tipo_emprendimiento = session.exec(
        select(CRMTipoOperacion).where(CRMTipoOperacion.id == 3)
    ).first()
    
    propiedades_data = [
        # Para Torres del Puerto
        {
            "nombre": "Torre 1 - Piso 5 - Depto A",
            "tipo": "departamento",
            "descripcion": "Monoambiente de 35m² con balcón. Vista al río. Entrega 2026.",
            "superficie_cubierta": Decimal("35.00"),
            "superficie_total": Decimal("40.00"),
            "precio_venta_estimado": Decimal("280000.00"),
            "precio_moneda_id": 2,
            "estado": "1-ingresada",
            "tipo_operacion_id": 3
        },
        {
            "nombre": "Torre 1 - Piso 12 - Depto B",
            "tipo": "departamento",
            "descripcion": "2 ambientes de 58m² con cochera. Vista panorámica. Entrega 2026.",
            "superficie_cubierta": Decimal("58.00"),
            "superficie_total": Decimal("65.00"),
            "precio_venta_estimado": Decimal("420000.00"),
            "precio_moneda_id": 2,
            "estado": "1-ingresada",
            "tipo_operacion_id": 3
        },
        {
            "nombre": "Torre 2 - Piso 18 - Depto C",
            "tipo": "departamento",
            "descripcion": "3 ambientes de 85m² con 2 cocheras. Premium. Entrega 2026.",
            "superficie_cubierta": Decimal("85.00"),
            "superficie_total": Decimal("95.00"),
            "precio_venta_estimado": Decimal("650000.00"),
            "precio_moneda_id": 2,
            "estado": "1-ingresada",
            "tipo_operacion_id": 3
        },
        # Para Nordelta Business Park
        {
            "nombre": "Oficina Torre A - Piso 3",
            "tipo": "oficina",
            "descripcion": "Oficina corporativa de 120m². Piso completo. Entrega 2027.",
            "superficie_cubierta": Decimal("120.00"),
            "superficie_total": Decimal("130.00"),
            "precio_venta_estimado": Decimal("180000.00"),
            "precio_moneda_id": 2,
            "estado": "1-ingresada",
            "tipo_operacion_id": 3
        },
        {
            "nombre": "Local Comercial PB Torre B",
            "tipo": "local",
            "descripcion": "Local comercial 80m² con vidriera. Ideal gastronomía. Entrega 2027.",
            "superficie_cubierta": Decimal("80.00"),
            "superficie_total": Decimal("85.00"),
            "precio_venta_estimado": Decimal("150000.00"),
            "precio_moneda_id": 2,
            "estado": "1-ingresada",
            "tipo_operacion_id": 3
        },
        {
            "nombre": "Oficina Torre B - Piso 5",
            "tipo": "oficina",
            "descripcion": "Oficina de 95m² con balcón terraza. Vista al verde. Entrega 2027.",
            "superficie_cubierta": Decimal("95.00"),
            "superficie_total": Decimal("105.00"),
            "precio_venta_estimado": Decimal("165000.00"),
            "precio_moneda_id": 2,
            "estado": "1-ingresada",
            "tipo_operacion_id": 3
        }
    ]
    
    creadas = 0
    for i, prop_data in enumerate(propiedades_data):
        # Asignar a emprendimiento (primeras 3 a Torres del Puerto, resto a Nordelta)
        emprendimiento = emprendimientos[0] if i < 3 else emprendimientos[1] if len(emprendimientos) > 1 else emprendimientos[0]
        
        prop_data["emprendimiento_id"] = emprendimiento.id
        prop_data["ubicacion"] = emprendimiento.ubicacion
        prop_data["estado_comentario"] = f"Unidad en {emprendimiento.estado} - {emprendimiento.nombre}"
        prop_data["propietario"] = emprendimiento.nombre  # Usar nombre del emprendimiento como propietario
        
        propiedad = Propiedad(**prop_data)
        session.add(propiedad)
        session.flush()
        
        creadas += 1
        print(f"✅ Propiedad '{propiedad.nombre}' → {emprendimiento.nombre}")
        print(f"   Tipo: {propiedad.tipo} | Precio: USD {propiedad.precio_venta_estimado}")
    
    session.commit()
    print(f"\n✅ {creadas} propiedades creadas para emprendimientos")
    session.close()

def crear_oportunidades_variadas():
    """Crear oportunidades para todos los tipos de operación"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("4. CREANDO OPORTUNIDADES VARIADAS")
    print("="*80 + "\n")
    
    # Obtener datos necesarios
    contactos = session.exec(select(CRMContacto)).all()
    propiedades = session.exec(select(Propiedad)).all()
    tipos_operacion = session.exec(select(CRMTipoOperacion)).all()
    origenes = session.exec(select(CRMOrigenLead)).all()
    
    if not contactos or not propiedades:
        print("❌ Faltan contactos o propiedades")
        session.close()
        return
    
    # Crear un diccionario de tipos de operación
    tipos_dict = {t.id: t for t in tipos_operacion}
    
    oportunidades_data = [
        # ALQUILERES
        {
            "contacto_id": random.choice(contactos).id,
            "tipo_operacion_id": 1,  # Alquiler
            "propiedad_id": random.choice([p.id for p in propiedades if p.tipo_operacion_id == 1 and p.estado == "3-disponible"]) if any(p.tipo_operacion_id == 1 and p.estado == "3-disponible" for p in propiedades) else random.choice(propiedades).id,
            "estado": "1-abierta",
            "fecha_estado": datetime.now(UTC) - timedelta(days=5),
            "descripcion_estado": "Cliente busca departamento para alquiler a corto plazo",
            "probabilidad": 15,
            "moneda_id": 1,  # ARS
            "origen_lead_id": random.choice(origenes).id if origenes else None,
            "responsable_id": 1
        },
        {
            "contacto_id": random.choice(contactos).id,
            "tipo_operacion_id": 1,
            "propiedad_id": random.choice([p.id for p in propiedades if p.tipo_operacion_id == 1]) if any(p.tipo_operacion_id == 1 for p in propiedades) else random.choice(propiedades).id,
            "estado": "3-cotiza",
            "fecha_estado": datetime.now(UTC) - timedelta(days=2),
            "descripcion_estado": "Cotización enviada - cliente evaluando",
            "probabilidad": 60,
            "monto": Decimal("450000.00"),
            "moneda_id": 1,
            "origen_lead_id": random.choice(origenes).id if origenes else None,
            "responsable_id": 1
        },
        # VENTAS
        {
            "contacto_id": random.choice(contactos).id,
            "tipo_operacion_id": 2,  # Venta
            "propiedad_id": random.choice([p.id for p in propiedades if p.tipo_operacion_id == 2]) if any(p.tipo_operacion_id == 2 for p in propiedades) else random.choice(propiedades).id,
            "estado": "2-visita",
            "fecha_estado": datetime.now(UTC) - timedelta(days=3),
            "descripcion_estado": "Cliente visitó oficina en microcentro - interesado",
            "probabilidad": 40,
            "moneda_id": 2,  # USD
            "origen_lead_id": random.choice(origenes).id if origenes else None,
            "responsable_id": 1
        },
        {
            "contacto_id": random.choice(contactos).id,
            "tipo_operacion_id": 2,
            "propiedad_id": random.choice([p.id for p in propiedades if p.tipo_operacion_id == 2]) if any(p.tipo_operacion_id == 2 for p in propiedades) else random.choice(propiedades).id,
            "estado": "4-reserva",
            "fecha_estado": datetime.now(UTC) - timedelta(days=1),
            "descripcion_estado": "Reserva con seña del 10%",
            "probabilidad": 90,
            "monto": Decimal("250000.00"),
            "moneda_id": 2,
            "condicion_pago_id": 1,
            "origen_lead_id": random.choice(origenes).id if origenes else None,
            "responsable_id": 1
        },
        # EMPRENDIMIENTOS
        {
            "contacto_id": random.choice(contactos).id,
            "tipo_operacion_id": 3,  # Emprendimiento
            "propiedad_id": random.choice([p.id for p in propiedades if p.tipo_operacion_id == 3]) if any(p.tipo_operacion_id == 3 for p in propiedades) else random.choice(propiedades).id,
            "estado": "1-abierta",
            "fecha_estado": datetime.now(UTC) - timedelta(days=7),
            "descripcion_estado": "Consulta por unidad en Torres del Puerto - pre-venta",
            "probabilidad": 20,
            "moneda_id": 2,
            "origen_lead_id": random.choice(origenes).id if origenes else None,
            "responsable_id": 1
        },
        {
            "contacto_id": random.choice(contactos).id,
            "tipo_operacion_id": 3,
            "propiedad_id": random.choice([p.id for p in propiedades if p.tipo_operacion_id == 3]) if any(p.tipo_operacion_id == 3 for p in propiedades) else random.choice(propiedades).id,
            "estado": "2-visita",
            "fecha_estado": datetime.now(UTC) - timedelta(days=4),
            "descripcion_estado": "Visita a showroom - interesado en 2 ambientes",
            "probabilidad": 35,
            "moneda_id": 2,
            "origen_lead_id": random.choice(origenes).id if origenes else None,
            "responsable_id": 1
        },
        {
            "contacto_id": random.choice(contactos).id,
            "tipo_operacion_id": 3,
            "propiedad_id": random.choice([p.id for p in propiedades if p.tipo_operacion_id == 3]) if any(p.tipo_operacion_id == 3 for p in propiedades) else random.choice(propiedades).id,
            "estado": "3-cotiza",
            "fecha_estado": datetime.now(UTC) - timedelta(days=1),
            "descripcion_estado": "Cotización con plan de financiación - evaluando",
            "probabilidad": 55,
            "monto": Decimal("420000.00"),
            "moneda_id": 2,
            "origen_lead_id": random.choice(origenes).id if origenes else None,
            "responsable_id": 1
        },
        {
            "contacto_id": random.choice(contactos).id,
            "tipo_operacion_id": 3,
            "propiedad_id": random.choice([p.id for p in propiedades if p.tipo_operacion_id == 3]) if any(p.tipo_operacion_id == 3 for p in propiedades) else random.choice(propiedades).id,
            "estado": "4-reserva",
            "fecha_estado": datetime.now(UTC),
            "descripcion_estado": "Reserva confirmada - oficina Nordelta Business Park",
            "probabilidad": 85,
            "monto": Decimal("180000.00"),
            "moneda_id": 2,
            "condicion_pago_id": 1,
            "origen_lead_id": random.choice(origenes).id if origenes else None,
            "responsable_id": 1
        }
    ]
    
    creadas = 0
    for opp_data in oportunidades_data:
        try:
            oportunidad = CRMOportunidad(**opp_data)
            session.add(oportunidad)
            session.flush()
            
            tipo_nombre = tipos_dict.get(opp_data['tipo_operacion_id']).nombre if opp_data['tipo_operacion_id'] in tipos_dict else "N/A"
            creadas += 1
            print(f"✅ Oportunidad {oportunidad.id} | {tipo_nombre} | Estado: {oportunidad.estado}")
            print(f"   Propiedad: {opp_data['propiedad_id']} | Probabilidad: {oportunidad.probabilidad}%")
        except Exception as e:
            print(f"⚠️  Error creando oportunidad: {e}")
    
    session.commit()
    print(f"\n✅ {creadas} oportunidades creadas")
    session.close()

def crear_eventos_crm():
    """Crear eventos vinculados a contactos y oportunidades"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("5. CREANDO EVENTOS CRM")
    print("="*80 + "\n")
    
    contactos = session.exec(select(CRMContacto)).all()
    oportunidades = session.exec(select(CRMOportunidad)).all()
    tipos_evento = session.exec(select(CRMTipoEvento)).all()
    motivos = session.exec(select(CRMMotivoEvento)).all()
    
    if not contactos:
        print("❌ No hay contactos")
        session.close()
        return
    
    if not tipos_evento:
        print("❌ No hay tipos de evento en catálogo")
        session.close()
        return
    
    if not motivos:
        print("❌ No hay motivos de evento en catálogo")
        session.close()
        return
    
    # Crear mapeo por nombre de tipo
    tipo_map = {tipo.nombre.lower(): tipo.id for tipo in tipos_evento}
    
    eventos_data = [
        # Llamadas
        {
            "tipo_id": tipo_map.get("llamada", tipos_evento[0].id),
            "contacto_id": random.choice(contactos).id,
            "oportunidad_id": random.choice(oportunidades).id if oportunidades and random.random() > 0.3 else None,
            "fecha_evento": datetime.now(UTC) - timedelta(days=10),
            "descripcion": "Llamada inicial - consulta general sobre disponibilidad",
            "motivo_id": random.choice(motivos).id,
            "asignado_a_id": 1
        },
        {
            "tipo_id": tipo_map.get("llamada", tipos_evento[0].id),
            "contacto_id": random.choice(contactos).id,
            "oportunidad_id": random.choice(oportunidades).id if oportunidades else None,
            "fecha_evento": datetime.now(UTC) - timedelta(days=5),
            "descripcion": "Seguimiento post-visita - aclaración de dudas",
            "motivo_id": random.choice(motivos).id,
            "asignado_a_id": 1
        },
        # Reuniones
        {
            "tipo_id": tipo_map.get("reunion", tipo_map.get("reunión", tipos_evento[0].id)),
            "contacto_id": random.choice(contactos).id,
            "oportunidad_id": random.choice(oportunidades).id if oportunidades else None,
            "fecha_evento": datetime.now(UTC) - timedelta(days=8),
            "descripcion": "Reunión en oficina - presentación de emprendimiento",
            "motivo_id": random.choice(motivos).id,
            "asignado_a_id": 1
        },
        {
            "tipo_id": tipo_map.get("reunion", tipo_map.get("reunión", tipos_evento[0].id)),
            "contacto_id": random.choice(contactos).id,
            "oportunidad_id": random.choice(oportunidades).id if oportunidades else None,
            "fecha_evento": datetime.now(UTC) - timedelta(days=2),
            "descripcion": "Reunión de cierre - negociación final",
            "motivo_id": random.choice(motivos).id,
            "asignado_a_id": 1
        },
        # Visitas
        {
            "tipo_id": tipo_map.get("visita", tipos_evento[0].id),
            "contacto_id": random.choice(contactos).id,
            "oportunidad_id": random.choice(oportunidades).id if oportunidades else None,
            "fecha_evento": datetime.now(UTC) - timedelta(days=6),
            "descripcion": "Visita a propiedad - recorrida completa",
            "motivo_id": random.choice(motivos).id,
            "asignado_a_id": 1
        },
        {
            "tipo_id": tipo_map.get("visita", tipos_evento[0].id),
            "contacto_id": random.choice(contactos).id,
            "oportunidad_id": random.choice(oportunidades).id if oportunidades else None,
            "fecha_evento": datetime.now(UTC) - timedelta(days=3),
            "descripcion": "Segunda visita con familia - confirmación",
            "motivo_id": random.choice(motivos).id,
            "asignado_a_id": 1
        },
        # Emails
        {
            "tipo_id": tipo_map.get("email", tipos_evento[0].id),
            "contacto_id": random.choice(contactos).id,
            "oportunidad_id": random.choice(oportunidades).id if oportunidades else None,
            "fecha_evento": datetime.now(UTC) - timedelta(days=4),
            "descripcion": "Envío de cotización detallada con planos",
            "motivo_id": random.choice(motivos).id,
            "asignado_a_id": 1
        },
        {
            "tipo_id": tipo_map.get("email", tipos_evento[0].id),
            "contacto_id": random.choice(contactos).id,
            "oportunidad_id": random.choice(oportunidades).id if oportunidades else None,
            "fecha_evento": datetime.now(UTC) - timedelta(days=1),
            "descripcion": "Envío de contrato de reserva",
            "motivo_id": random.choice(motivos).id,
            "asignado_a_id": 1
        }
    ]
    
    creados = 0
    for evento_data in eventos_data:
        try:
            evento = CRMEvento(**evento_data)
            session.add(evento)
            session.flush()
            
            creados += 1
            tipo_nombre = next((t.nombre for t in tipos_evento if t.id == evento.tipo_id), "N/A")
            print(f"✅ Evento {evento.id} | {tipo_nombre} | Contacto: {evento.contacto_id}")
            if evento.oportunidad_id:
                print(f"   Vinculado a Oportunidad: {evento.oportunidad_id}")
        except Exception as e:
            print(f"⚠️  Error creando evento: {e}")
            session.rollback()  # Rollback para continuar
    
    if creados > 0:
        session.commit()
        print(f"\n✅ {creados} eventos creados")
    else:
        print(f"\n⚠️  No se pudieron crear eventos")
    
    session.close()

def verificar_consistencia_final():
    """Verificar que todo sea consistente"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("6. VERIFICACIÓN FINAL DE CONSISTENCIA")
    print("="*80 + "\n")
    
    # 1. Emprendimientos
    emprendimientos = session.exec(select(Emprendimiento)).all()
    print(f"📊 Emprendimientos: {len(emprendimientos)}")
    for emp in emprendimientos:
        propiedades_vinculadas = session.exec(
            select(Propiedad).where(Propiedad.emprendimiento_id == emp.id)
        ).all()
        print(f"   {emp.nombre}: {len(propiedades_vinculadas)} propiedades vinculadas")
    
    # 2. Propiedades por tipo de operación
    print(f"\n📊 Propiedades por tipo de operación:")
    tipos = session.exec(select(CRMTipoOperacion)).all()
    for tipo in tipos:
        props = session.exec(
            select(Propiedad).where(Propiedad.tipo_operacion_id == tipo.id)
        ).all()
        print(f"   {tipo.nombre}: {len(props)} propiedades")
    
    # 3. Oportunidades por tipo de operación
    print(f"\n📊 Oportunidades por tipo de operación:")
    for tipo in tipos:
        opps = session.exec(
            select(CRMOportunidad).where(CRMOportunidad.tipo_operacion_id == tipo.id)
        ).all()
        print(f"   {tipo.nombre}: {len(opps)} oportunidades")
        
        # Por estado
        estados = {}
        for opp in opps:
            estados[opp.estado] = estados.get(opp.estado, 0) + 1
        for estado, count in sorted(estados.items()):
            print(f"      {estado}: {count}")
    
    # 4. Eventos
    eventos = session.exec(select(CRMEvento)).all()
    print(f"\n📊 Eventos totales: {len(eventos)}")
    eventos_por_tipo = {}
    for evento in eventos:
        # Acceder al tipo via la relación
        tipo_nombre = evento.tipo.nombre if evento.tipo else "Sin tipo"
        eventos_por_tipo[tipo_nombre] = eventos_por_tipo.get(tipo_nombre, 0) + 1
    for tipo, count in sorted(eventos_por_tipo.items()):
        print(f"   {tipo}: {count}")
    
    # 5. Verificar inconsistencias
    print(f"\n🔍 Verificación de inconsistencias:")
    
    inconsistencias = []
    
    # Oportunidades de emprendimiento sin emprendimiento_id en propiedad
    opps_emprendimiento = session.exec(
        select(CRMOportunidad).where(CRMOportunidad.tipo_operacion_id == 3)
    ).all()
    
    for opp in opps_emprendimiento:
        prop = session.get(Propiedad, opp.propiedad_id)
        if prop and not prop.emprendimiento_id:
            inconsistencias.append(f"Oportunidad {opp.id} es de emprendimiento pero propiedad {prop.id} no tiene emprendimiento_id")
    
    # Propiedades con emprendimiento_id pero tipo_operacion != 3
    props_con_emp = session.exec(
        select(Propiedad).where(Propiedad.emprendimiento_id.isnot(None))
    ).all()
    
    for prop in props_con_emp:
        if prop.tipo_operacion_id != 3:
            inconsistencias.append(f"Propiedad {prop.id} tiene emprendimiento pero tipo_operacion_id != 3")
    
    if inconsistencias:
        print("   ❌ Inconsistencias encontradas:")
        for inc in inconsistencias:
            print(f"      {inc}")
    else:
        print("   ✅ No se encontraron inconsistencias")
    
    session.close()

if __name__ == "__main__":
    print("\n" + "="*80)
    print("CREACIÓN COMPLETA DE EMPRENDIMIENTOS Y DATOS CRM")
    print("="*80)
    
    try:
        # 1. Crear emprendimientos
        print("\nOmitiendo creación de emprendimientos (ya existen)")
        
        # 2. Asignar terrenos
        print("Omitiendo asignación de terrenos (sin terrenos disponibles)")
        
        # 3. Crear propiedades nuevas
        print("Omitiendo creación de propiedades (ya existen)")
        
        # 4. Crear oportunidades variadas
        print("Omitiendo creación de oportunidades (ya existen)")
        
        # 5. Crear eventos
        crear_eventos_crm()
        
        # 6. Verificar consistencia
        verificar_consistencia_final()
        
        print("\n" + "="*80)
        print("✅ PROCESO COMPLETADO EXITOSAMENTE")
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
