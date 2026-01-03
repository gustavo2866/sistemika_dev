"""
Tests para validar la lógica de asignación automática de tipo_operacion_id
en oportunidades creadas desde webhooks de WhatsApp.
"""
import pytest
from datetime import datetime, UTC
from sqlmodel import Session, select

from app.models import CRMContacto, CRMOportunidad, Propiedad, CRMTipoOperacion
from app.models.user import User
from app.services.meta_webhook_service import MetaWebhookService


def test_contacto_con_propiedad_alquiler_disponible(session: Session):
    """
    CASO 1: Contacto con propiedad en alquiler disponible
    → tipo_operacion_id = 3 (mantenimiento)
    """
    # Setup: Crear usuario
    usuario = User(
        email="test@example.com",
        username="testuser",
        full_name="Test User",
        is_active=True
    )
    session.add(usuario)
    session.commit()
    
    # Setup: Crear contacto
    contacto = CRMContacto(
        nombre_completo="Cliente con Alquiler",
        telefonos=["+5491112345678"],
        responsable_id=usuario.id,
        activo=True
    )
    session.add(contacto)
    session.commit()
    
    # Setup: Crear propiedad en alquiler disponible
    propiedad = Propiedad(
        nombre="Depto 101",
        tipo="Departamento",
        propietario="Test Owner",
        estado="3-disponible",
        contacto_id=contacto.id,
        tipo_operacion_id=1,  # Alquiler
        activo=True
    )
    session.add(propiedad)
    session.commit()
    
    # Test
    service = MetaWebhookService(session)
    tipo_op = service._determinar_tipo_operacion_contacto(contacto.id)
    
    assert tipo_op == 3, "Debería retornar 3 (mantenimiento) para contacto con propiedad en alquiler"


def test_contacto_con_propiedad_alquiler_alquilada(session: Session):
    """
    CASO 2: Contacto con propiedad en alquiler ya alquilada
    → tipo_operacion_id = 3 (mantenimiento)
    """
    usuario = User(
        email="test2@example.com",
        username="testuser2",
        full_name="Test User 2",
        is_active=True
    )
    session.add(usuario)
    session.commit()
    
    contacto = CRMContacto(
        nombre_completo="Cliente con Propiedad Alquilada",
        telefonos=["+5491112345679"],
        responsable_id=usuario.id,
        activo=True
    )
    session.add(contacto)
    session.commit()
    
    propiedad = Propiedad(
        nombre="Casa 202",
        tipo="Casa",
        propietario="Test Owner 2",
        estado="4-alquilada",
        contacto_id=contacto.id,
        tipo_operacion_id=1,  # Alquiler
        activo=True
    )
    session.add(propiedad)
    session.commit()
    
    service = MetaWebhookService(session)
    tipo_op = service._determinar_tipo_operacion_contacto(contacto.id)
    
    assert tipo_op == 3, "Debería retornar 3 (mantenimiento) para propiedad alquilada"


def test_contacto_sin_propiedades(session: Session):
    """
    CASO 3: Contacto sin propiedades
    → tipo_operacion_id = None
    """
    usuario = User(
        email="test3@example.com",
        username="testuser3",
        full_name="Test User 3",
        is_active=True
    )
    session.add(usuario)
    session.commit()
    
    contacto = CRMContacto(
        nombre_completo="Cliente Sin Propiedades",
        telefonos=["+5491112345680"],
        responsable_id=usuario.id,
        activo=True
    )
    session.add(contacto)
    session.commit()
    
    service = MetaWebhookService(session)
    tipo_op = service._determinar_tipo_operacion_contacto(contacto.id)
    
    assert tipo_op is None, "Debería retornar None para contacto sin propiedades"


def test_contacto_con_propiedad_venta(session: Session):
    """
    CASO 4: Contacto con propiedad en venta (tipo_operacion_id=2)
    → tipo_operacion_id = None
    """
    usuario = User(
        email="test4@example.com",
        username="testuser4",
        full_name="Test User 4",
        is_active=True
    )
    session.add(usuario)
    session.commit()
    
    contacto = CRMContacto(
        nombre_completo="Cliente con Venta",
        telefonos=["+5491112345681"],
        responsable_id=usuario.id,
        activo=True
    )
    session.add(contacto)
    session.commit()
    
    propiedad = Propiedad(
        nombre="Oficina 303",
        tipo="Oficina",
        propietario="Test Owner 4",
        estado="3-disponible",
        contacto_id=contacto.id,
        tipo_operacion_id=2,  # Venta
        activo=True
    )
    session.add(propiedad)
    session.commit()
    
    service = MetaWebhookService(session)
    tipo_op = service._determinar_tipo_operacion_contacto(contacto.id)
    
    assert tipo_op is None, "Debería retornar None para propiedad en venta"


def test_contacto_con_propiedad_alquiler_recibida(session: Session):
    """
    CASO 5: Contacto con propiedad en alquiler pero estado "1-recibida" (no operativa)
    → tipo_operacion_id = None
    """
    usuario = User(
        email="test5@example.com",
        username="testuser5",
        full_name="Test User 5",
        is_active=True
    )
    session.add(usuario)
    session.commit()
    
    contacto = CRMContacto(
        nombre_completo="Cliente con Propiedad Recibida",
        telefonos=["+5491112345682"],
        responsable_id=usuario.id,
        activo=True
    )
    session.add(contacto)
    session.commit()
    
    propiedad = Propiedad(
        nombre="Local 404",
        tipo="Local",
        propietario="Test Owner 5",
        estado="1-recibida",  # No operativa
        contacto_id=contacto.id,
        tipo_operacion_id=1,  # Alquiler
        activo=True
    )
    session.add(propiedad)
    session.commit()
    
    service = MetaWebhookService(session)
    tipo_op = service._determinar_tipo_operacion_contacto(contacto.id)
    
    assert tipo_op is None, "Debería retornar None para propiedad en estado no operativo"


def test_contacto_con_propiedad_inactiva(session: Session):
    """
    CASO 6: Contacto con propiedad en alquiler pero marcada como inactiva
    → tipo_operacion_id = None
    """
    usuario = User(
        email="test6@example.com",
        username="testuser6",
        full_name="Test User 6",
        is_active=True
    )
    session.add(usuario)
    session.commit()
    
    contacto = CRMContacto(
        nombre_completo="Cliente con Propiedad Inactiva",
        telefonos=["+5491112345683"],
        responsable_id=usuario.id,
        activo=True
    )
    session.add(contacto)
    session.commit()
    
    propiedad = Propiedad(
        nombre="Terreno 505",
        tipo="Terreno",
        propietario="Test Owner 6",
        estado="3-disponible",
        contacto_id=contacto.id,
        tipo_operacion_id=1,  # Alquiler
        activo=False  # Inactiva
    )
    session.add(propiedad)
    session.commit()
    
    service = MetaWebhookService(session)
    tipo_op = service._determinar_tipo_operacion_contacto(contacto.id)
    
    assert tipo_op is None, "Debería retornar None para propiedad inactiva"


def test_contacto_con_multiples_propiedades_mix(session: Session):
    """
    CASO 7: Contacto con múltiples propiedades (mix alquiler + venta)
    → tipo_operacion_id = 3 (prioriza alquiler)
    """
    usuario = User(
        email="test7@example.com",
        username="testuser7",
        full_name="Test User 7",
        is_active=True
    )
    session.add(usuario)
    session.commit()
    
    contacto = CRMContacto(
        nombre_completo="Cliente con Múltiples Propiedades",
        telefonos=["+5491112345684"],
        responsable_id=usuario.id,
        activo=True
    )
    session.add(contacto)
    session.commit()
    
    # Propiedad en venta
    prop_venta = Propiedad(
        nombre="Propiedad Venta",
        tipo="Casa",
        propietario="Test Owner 7",
        estado="3-disponible",
        contacto_id=contacto.id,
        tipo_operacion_id=2,  # Venta
        activo=True
    )
    session.add(prop_venta)
    
    # Propiedad en alquiler
    prop_alquiler = Propiedad(
        nombre="Propiedad Alquiler",
        tipo="Departamento",
        propietario="Test Owner 7",
        estado="4-alquilada",
        contacto_id=contacto.id,
        tipo_operacion_id=1,  # Alquiler
        activo=True
    )
    session.add(prop_alquiler)
    session.commit()
    
    service = MetaWebhookService(session)
    tipo_op = service._determinar_tipo_operacion_contacto(contacto.id)
    
    assert tipo_op == 3, "Debería retornar 3 cuando hay al menos una propiedad en alquiler operativa"
