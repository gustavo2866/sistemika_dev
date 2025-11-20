"""
Seed inicial para las tablas CRM (catálogos, contactos, oportunidades, eventos).

Uso:
  python scripts/seed_crm.py

El script es idempotente: sólo inserta registros que no existan.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, date
from decimal import Decimal
from pathlib import Path

from sqlmodel import Session, select

# Agregar backend al PYTHONPATH y cargar .env
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

from app.db import engine
from app.models import (
    CRMCondicionPago,
    CRMContacto,
    CRMEvento,
    CRMMotivoEvento,
    CRMMotivoPerdida,
    CRMOrigenLead,
    CRMOportunidad,
    CRMTipoEvento,
    CRMTipoOperacion,
    CRMOportunidadLogEstado,
    CotizacionMoneda,
    Emprendimiento,
    Moneda,
    Propiedad,
    User,
)

CATALOGOS = {
    CRMTipoOperacion: [
        {"codigo": "alquiler", "nombre": "Alquiler", "descripcion": "Operaciones de renta"},
        {"codigo": "venta", "nombre": "Venta", "descripcion": "Operaciones tradicionales"},
        {"codigo": "emprendimiento", "nombre": "Emprendimiento", "descripcion": "Preventas/pozo"},
    ],
    CRMMotivoPerdida: [
        {"codigo": "precio", "nombre": "Precio muy alto"},
        {"codigo": "ubicacion", "nombre": "Ubicación no conveniente"},
        {"codigo": "estado", "nombre": "Estado de la propiedad"},
        {"codigo": "competencia", "nombre": "Eligió otra opción"},
        {"codigo": "financiamiento", "nombre": "Sin financiamiento"},
        {"codigo": "desistio", "nombre": "Desistió"},
        {"codigo": "no_responde", "nombre": "No responde"},
        {"codigo": "ya_vendida", "nombre": "Propiedad ya vendida/alquilada"},
        {"codigo": "otro", "nombre": "Otro motivo"},
    ],
    CRMCondicionPago: [
        {"codigo": "contado", "nombre": "Contado"},
        {"codigo": "30_dias", "nombre": "30 días"},
        {"codigo": "60_dias", "nombre": "60 días"},
        {"codigo": "cuotas_3", "nombre": "3 cuotas"},
        {"codigo": "cuotas_6", "nombre": "6 cuotas"},
        {"codigo": "cuotas_12", "nombre": "12 cuotas"},
        {"codigo": "hipotecario", "nombre": "Crédito hipotecario"},
        {"codigo": "permuta", "nombre": "Permuta"},
        {"codigo": "otro", "nombre": "Otra condición"},
    ],
    CRMTipoEvento: [
        {"codigo": "presencial", "nombre": "Presencial"},
        {"codigo": "whatsapp", "nombre": "WhatsApp"},
        {"codigo": "llamado", "nombre": "Llamado"},
        {"codigo": "mail", "nombre": "Email"},
        {"codigo": "redes", "nombre": "Redes sociales"},
    ],
    CRMMotivoEvento: [
        {"codigo": "consulta", "nombre": "Consulta"},
        {"codigo": "visita", "nombre": "Visita"},
        {"codigo": "oferta", "nombre": "Oferta / contraoferta"},
        {"codigo": "seguimiento", "nombre": "Seguimiento"},
        {"codigo": "otros", "nombre": "Otros"},
    ],
    CRMOrigenLead: [
        {"codigo": "online", "nombre": "Online"},
        {"codigo": "referidos", "nombre": "Referidos"},
        {"codigo": "walk_in", "nombre": "Walk-in"},
        {"codigo": "campana", "nombre": "Campaña"},
        {"codigo": "otros", "nombre": "Otros"},
    ],
}

MONEDAS = [
    {"codigo": "ARS", "nombre": "Peso Argentino", "simbolo": "$", "es_moneda_base": True},
    {"codigo": "USD", "nombre": "Dólar Estadounidense", "simbolo": "U$", "es_moneda_base": False},
    {"codigo": "EUR", "nombre": "Euro", "simbolo": "€", "es_moneda_base": False},
]

COTIZACIONES = [
    {"moneda_origen": "USD", "moneda_destino": "ARS", "tipo_cambio": Decimal("875.00"), "fecha_vigencia": date(2025, 11, 18), "fuente": "BCRA"},
    {"moneda_origen": "EUR", "moneda_destino": "ARS", "tipo_cambio": Decimal("950.00"), "fecha_vigencia": date(2025, 11, 18), "fuente": "BCRA"},
    {"moneda_origen": "ARS", "moneda_destino": "USD", "tipo_cambio": Decimal("0.001142"), "fecha_vigencia": date(2025, 11, 18), "fuente": "BCRA"},
]

CONTACTOS = [
    {
        "nombre_completo": "Juan Pérez",
        "telefonos": ["+541122334455", "+541166778899"],
        "email": "juan.perez@example.com",
        "origen_lead_codigo": "online",
        "notas": "Contacto inicial por web",
    },
    {
        "nombre_completo": "María González",
        "telefonos": ["+541155667788"],
        "email": "maria.gonzalez@example.com",
        "origen_lead_codigo": "referidos",
        "notas": "Referido por cliente actual",
    },
]

OPORTUNIDADES = [
    {
        "email_contacto": "juan.perez@example.com",
        "tipo_operacion": "alquiler",
        "propiedad_id": 1,
        "estado": "1-abierta",
        "fecha_estado": datetime(2025, 11, 10, 10, 0, 0),
        "descripcion_estado": "Consulta inicial por departamento Palermo",
    },
    {
        "email_contacto": "maria.gonzalez@example.com",
        "tipo_operacion": "venta",
        "propiedad_id": 3,
        "estado": "2-visita",
        "fecha_estado": datetime(2025, 11, 12, 15, 0, 0),
        "monto": Decimal("250000"),
        "moneda": "USD",
        "descripcion_estado": "Visita programada para el 15/11",
    },
]

EVENTOS = [
    {
        "email_contacto": "juan.perez@example.com",
        "tipo": "presencial",
        "motivo": "consulta",
        "fecha_evento": datetime(2025, 11, 10, 10, 0, 0),
        "descripcion": "Cliente consultó por departamento de 2 ambientes",
        "email_oportunidad": "juan.perez@example.com",
        "estado_evento": "hecho",
    },
    {
        "email_contacto": "maria.gonzalez@example.com",
        "tipo": "whatsapp",
        "motivo": "visita",
        "fecha_evento": datetime(2025, 11, 12, 15, 0, 0),
        "descripcion": "Coordinar visita a oficina en Microcentro",
        "proximo_paso": "Confirmar horario",
        "fecha_compromiso": date(2025, 11, 14),
        "estado_evento": "pendiente",
        "email_oportunidad": "maria.gonzalez@example.com",
    },
]


def get_responsable(session: Session) -> User:
    user = session.exec(select(User)).first()
    if not user:
        user = User(nombre="Usuario CRM", email="crm@example.com")
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


def seed_catalogos(session: Session) -> None:
    for model, items in CATALOGOS.items():
        for data in items:
            codigo = data["codigo"]
            exists = session.exec(select(model).where(model.codigo == codigo)).first()
            if exists:
                continue
            session.add(model(**data))
    session.commit()


def seed_monedas(session: Session) -> dict[str, Moneda]:
    codigo_map: dict[str, Moneda] = {}
    for data in MONEDAS:
        codigo = data["codigo"]
        moneda = session.exec(select(Moneda).where(Moneda.codigo == codigo)).first()
        if not moneda:
            moneda = Moneda(**data)
            session.add(moneda)
            session.commit()
            session.refresh(moneda)
        codigo_map[codigo] = moneda
    return codigo_map


def seed_cotizaciones(session: Session, moneda_map: dict[str, Moneda]) -> None:
    for item in COTIZACIONES:
        origen = moneda_map[item["moneda_origen"]]
        destino = moneda_map[item["moneda_destino"]]
        exists = session.exec(
            select(CotizacionMoneda).where(
                (CotizacionMoneda.moneda_origen_id == origen.id)
                & (CotizacionMoneda.moneda_destino_id == destino.id)
                & (CotizacionMoneda.fecha_vigencia == item["fecha_vigencia"])
            )
        ).first()
        if exists:
            continue
        session.add(
            CotizacionMoneda(
                moneda_origen_id=origen.id,
                moneda_destino_id=destino.id,
                tipo_cambio=item["tipo_cambio"],
                fecha_vigencia=item["fecha_vigencia"],
                fuente=item["fuente"],
            )
        )
    session.commit()


def seed_contactos(session: Session, responsable_id: int, origen_map: dict[str, CRMOrigenLead]) -> dict[str, CRMContacto]:
    contactos: dict[str, CRMContacto] = {}
    for data in CONTACTOS:
        email = data["email"]
        contacto = session.exec(select(CRMContacto).where(CRMContacto.email == email)).first()
        if contacto:
            contactos[email] = contacto
            continue
        contacto = CRMContacto(
            nombre_completo=data["nombre_completo"],
            telefonos=data["telefonos"],
            email=email,
            origen_lead_id=origen_map[data["origen_lead_codigo"]].id if data["origen_lead_codigo"] else None,
            responsable_id=responsable_id,
            notas=data.get("notas"),
        )
        session.add(contacto)
        session.commit()
        session.refresh(contacto)
        contactos[email] = contacto
    return contactos


def seed_oportunidades(
    session: Session,
    contactos: dict[str, CRMContacto],
    responsable_id: int,
    tipo_map: dict[str, CRMTipoOperacion],
    moneda_map: dict[str, Moneda],
) -> dict[str, CRMOportunidad]:
    oportunidades: dict[str, CRMOportunidad] = {}
    for item in OPORTUNIDADES:
        contacto = contactos[item["email_contacto"]]
        existente = session.exec(
            select(CRMOportunidad).where(
                (CRMOportunidad.contacto_id == contacto.id)
                & (CRMOportunidad.descripcion_estado == item["descripcion_estado"])
            )
        ).first()
        if existente:
            oportunidades[item["email_contacto"]] = existente
            continue

        propiedad = session.get(Propiedad, item["propiedad_id"])
        if not propiedad:
            propiedad = session.exec(select(Propiedad)).first()
            if not propiedad:
                print(f"[WARN] No hay propiedades disponibles para sembrar oportunidades.")
                break
            print(
                f"[WARN] Propiedad {item['propiedad_id']} no existe, se usa Propiedad ID {propiedad.id}."
            )

        oportunidad = CRMOportunidad(
            contacto_id=contacto.id,
            tipo_operacion_id=tipo_map[item["tipo_operacion"]].id,
            propiedad_id=propiedad.id,
            estado=item["estado"],
            fecha_estado=item["fecha_estado"],
            responsable_id=responsable_id,
            descripcion_estado=item["descripcion_estado"],
            monto=item.get("monto"),
            moneda_id=moneda_map[item["moneda"]].id if item.get("moneda") else None,
        )
        session.add(oportunidad)
        session.commit()
        session.refresh(oportunidad)
        oportunidades[item["email_contacto"]] = oportunidad
    return oportunidades


def seed_eventos(
    session: Session,
    contactos: dict[str, CRMContacto],
    oportunidades: dict[str, CRMOportunidad],
    responsable_id: int,
    tipo_map: dict[str, CRMTipoEvento],
    motivo_map: dict[str, CRMMotivoEvento],
    origen_map: dict[str, CRMOrigenLead],
) -> None:
    for item in EVENTOS:
        contacto = contactos[item["email_contacto"]]
        exists = session.exec(
            select(CRMEvento).where(
                (CRMEvento.contacto_id == contacto.id)
                & (CRMEvento.descripcion == item["descripcion"])
            )
        ).first()
        if exists:
            continue
        evento = CRMEvento(
            contacto_id=contacto.id,
            tipo_id=tipo_map[item["tipo"]].id,
            motivo_id=motivo_map[item["motivo"]].id,
            fecha_evento=item["fecha_evento"],
            descripcion=item["descripcion"],
            asignado_a_id=responsable_id,
            oportunidad_id=oportunidades.get(item.get("email_oportunidad")).id if item.get("email_oportunidad") in oportunidades else None,
            origen_lead_id=origen_map.get("online").id,
            proximo_paso=item.get("proximo_paso"),
            fecha_compromiso=item.get("fecha_compromiso"),
            estado_evento=item.get("estado_evento", "pendiente"),
        )
        session.add(evento)
    session.commit()


def main() -> None:
    print(f"Usando DATABASE_URL={os.getenv('DATABASE_URL')}")
    with Session(engine) as session:
        responsable = get_responsable(session)
        seed_catalogos(session)
        tipo_operacion_map = {obj.codigo: obj for obj in session.exec(select(CRMTipoOperacion)).all()}
        motivo_evento_map = {obj.codigo: obj for obj in session.exec(select(CRMMotivoEvento)).all()}
        tipo_evento_map = {obj.codigo: obj for obj in session.exec(select(CRMTipoEvento)).all()}
        origen_lead_map = {obj.codigo: obj for obj in session.exec(select(CRMOrigenLead)).all()}

        moneda_map = seed_monedas(session)
        seed_cotizaciones(session, moneda_map)

        contactos = seed_contactos(session, responsable.id, origen_lead_map)
        oportunidades = seed_oportunidades(session, contactos, responsable.id, tipo_operacion_map, moneda_map)
        seed_eventos(session, contactos, oportunidades, responsable.id, tipo_evento_map, motivo_evento_map, origen_lead_map)

    print("Seed CRM completado.")


if __name__ == "__main__":
    main()
