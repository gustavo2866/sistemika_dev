"""
Tests para CRM Oportunidad Service
Valida transiciones de estado, sincronización con propiedades/vacancias
"""
import sys
import os
# Agregar backend al path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

import pytest
from datetime import datetime, UTC
from sqlmodel import Session, select
from app.db import engine, init_db
from app.services.crm_oportunidad_service import crm_oportunidad_service
from app.models import (
    CRMOportunidad, 
    CRMOportunidadLogEstado, 
    Propiedad, 
    Vacancia,
    CRMContacto
)
from app.models.enums import EstadoPropiedad


@pytest.fixture(scope="module")
def session():
    """Crear sesión de DB para tests"""
    init_db()
    with Session(engine) as session:
        yield session


def test_cambiar_estado_transicion_valida(session: Session):
    """Test transición válida: Abierta -> Visita"""
    # Crear oportunidad en estado Abierta
    oportunidad = CRMOportunidad(
        contacto_id=1,
        tipo_operacion_id=1,
        propiedad_id=2,
        estado="1-abierta",
        responsable_id=1,
        moneda_id=1,
        descripcion_estado="Test transición válida"
    )
    session.add(oportunidad)
    session.commit()
    session.refresh(oportunidad)
    oportunidad_id = oportunidad.id
    
    # Cambiar a Visita
    resultado = crm_oportunidad_service.cambiar_estado(
        session=session,
        oportunidad_id=oportunidad_id,
        nuevo_estado="2-visita",
        descripcion="Cliente visitó la propiedad",
        usuario_id=1
    )
    
    assert resultado.estado == "2-visita"
    assert resultado.descripcion_estado == "Cliente visitó la propiedad"
    
    # Verificar que se creó el log
    logs = session.exec(
        select(CRMOportunidadLogEstado).where(
            CRMOportunidadLogEstado.oportunidad_id == oportunidad_id
        )
    ).all()
    assert len(logs) >= 1
    ultimo_log = logs[-1]
    assert ultimo_log.estado_anterior == "1-abierta"
    assert ultimo_log.estado_nuevo == "2-visita"
    
    print(f"✅ Test 1 OK: Transición Abierta->Visita funciona. Log creado: {len(logs)} registros")


def test_cambiar_estado_transicion_invalida(session: Session):
    """Test transición inválida: Abierta -> Ganada debe fallar"""
    oportunidad = CRMOportunidad(
        contacto_id=1,
        tipo_operacion_id=1,
        propiedad_id=2,
        estado="1-abierta",
        responsable_id=1,
        moneda_id=1,
        descripcion_estado="Test transición inválida"
    )
    session.add(oportunidad)
    session.commit()
    session.refresh(oportunidad)
    
    # Intentar cambio inválido directo a ganada
    try:
        crm_oportunidad_service.cambiar_estado(
            session=session,
            oportunidad_id=oportunidad.id,
            nuevo_estado="5-ganada",
            descripcion="Intento inválido",
            usuario_id=1
        )
        assert False, "Debería haber fallado la transición inválida"
    except ValueError as e:
        assert "no permitida" in str(e).lower() or "transición" in str(e).lower()
        print(f"✅ Test 2 OK: Transición inválida rechazada correctamente: {e}")


def test_cambiar_a_ganada_sincroniza_propiedad(session: Session):
    """Test que cambiar a Ganada actualiza la propiedad a alquilada"""
    # Obtener una propiedad y asegurar que esté disponible
    propiedad = session.get(Propiedad, 3)
    if propiedad:
        propiedad.estado = "3-disponible"
        session.add(propiedad)
        session.commit()
    
    # Crear oportunidad en estado Reserva
    oportunidad = CRMOportunidad(
        contacto_id=1,
        tipo_operacion_id=1,
        propiedad_id=3,
        estado="4-reserva",
        responsable_id=1,
        moneda_id=1,
        descripcion_estado="Test sincronización"
    )
    session.add(oportunidad)
    session.commit()
    session.refresh(oportunidad)
    
    # Cambiar a Ganada
    resultado = crm_oportunidad_service.cambiar_estado(
        session=session,
        oportunidad_id=oportunidad.id,
        nuevo_estado="5-ganada",
        descripcion="Cliente firmó contrato",
        usuario_id=1,
        monto=150000,
        moneda_id=2,
        condicion_pago_id=1
    )
    
    assert resultado.estado == "5-ganada"
    assert resultado.monto == 150000
    
    # Verificar que la propiedad cambió a alquilada
    session.refresh(propiedad)
    assert propiedad.estado == "4-alquilada"
    
    print(f"✅ Test 3 OK: Sincronización Ganada->Alquilada funciona. Propiedad ID {propiedad.id}")


def test_cambiar_a_perdida_requiere_motivo(session: Session):
    """Test que cambiar a Perdida sin motivo falla"""
    oportunidad = CRMOportunidad(
        contacto_id=1,
        tipo_operacion_id=1,
        propiedad_id=2,
        estado="2-visita",
        responsable_id=1,
        moneda_id=1,
        descripcion_estado="Test motivo requerido"
    )
    session.add(oportunidad)
    session.commit()
    session.refresh(oportunidad)
    
    try:
        crm_oportunidad_service.cambiar_estado(
            session=session,
            oportunidad_id=oportunidad.id,
            nuevo_estado="6-perdida",
            descripcion="Cliente no interesado",
            usuario_id=1
            # Sin motivo_perdida_id
        )
        assert False, "Debería haber fallado sin motivo_perdida_id"
    except ValueError as e:
        assert "motivo" in str(e).lower() or "requerido" in str(e).lower()
        print(f"✅ Test 4 OK: Validación motivo_perdida funciona: {e}")


def test_cambiar_a_ganada_requiere_monto_y_condiciones(session: Session):
    """Test que cambiar a Ganada sin monto/condiciones falla"""
    oportunidad = CRMOportunidad(
        contacto_id=1,
        tipo_operacion_id=1,
        propiedad_id=2,
        estado="4-reserva",
        responsable_id=1,
        moneda_id=1,
        descripcion_estado="Test monto requerido"
    )
    session.add(oportunidad)
    session.commit()
    session.refresh(oportunidad)
    
    try:
        crm_oportunidad_service.cambiar_estado(
            session=session,
            oportunidad_id=oportunidad.id,
            nuevo_estado="5-ganada",
            descripcion="Falta datos",
            usuario_id=1
            # Sin monto ni condicion_pago_id
        )
        assert False, "Debería haber fallado sin monto y condiciones"
    except ValueError as e:
        assert "monto" in str(e).lower() or "condicion" in str(e).lower() or "requerido" in str(e).lower()
        print(f"✅ Test 5 OK: Validación monto/condiciones funciona: {e}")


def test_flujo_completo_abierta_a_ganada(session: Session):
    """Test flujo completo de estados"""
    # Crear oportunidad
    oportunidad = CRMOportunidad(
        contacto_id=1,
        tipo_operacion_id=1,
        propiedad_id=4,
        estado="1-abierta",
        responsable_id=1,
        moneda_id=1,
        descripcion_estado="Flujo completo test"
    )
    session.add(oportunidad)
    session.commit()
    session.refresh(oportunidad)
    oportunidad_id = oportunidad.id
    
    # 1. Abierta -> Visita
    crm_oportunidad_service.cambiar_estado(
        session=session,
        oportunidad_id=oportunidad_id,
        nuevo_estado="2-visita",
        descripcion="Cliente visitó",
        usuario_id=1
    )
    
    # 2. Visita -> Cotiza
    crm_oportunidad_service.cambiar_estado(
        session=session,
        oportunidad_id=oportunidad_id,
        nuevo_estado="3-cotiza",
        descripcion="Cotización enviada",
        usuario_id=1
    )
    
    # 3. Cotiza -> Reserva
    crm_oportunidad_service.cambiar_estado(
        session=session,
        oportunidad_id=oportunidad_id,
        nuevo_estado="4-reserva",
        descripcion="Cliente reservó",
        usuario_id=1,
        monto=50000,
        moneda_id=1,
        condicion_pago_id=1
    )
    
    # 4. Reserva -> Ganada
    resultado = crm_oportunidad_service.cambiar_estado(
        session=session,
        oportunidad_id=oportunidad_id,
        nuevo_estado="5-ganada",
        descripcion="Contrato firmado",
        usuario_id=1,
        monto=150000,
        moneda_id=2,
        condicion_pago_id=1
    )
    
    assert resultado.estado == "5-ganada"
    
    # Verificar logs (4 cambios)
    logs = session.exec(
        select(CRMOportunidadLogEstado).where(
            CRMOportunidadLogEstado.oportunidad_id == oportunidad_id
        )
    ).all()
    assert len(logs) == 4
    
    print(f"✅ Test 6 OK: Flujo completo Abierta->Ganada funciona. {len(logs)} cambios registrados")


if __name__ == "__main__":
    print("\n" + "="*80)
    print("EJECUTANDO TESTS: CRM Oportunidad Service")
    print("="*80 + "\n")
    
    with Session(engine) as session:
        try:
            test_cambiar_estado_transicion_valida(session)
            test_cambiar_estado_transicion_invalida(session)
            test_cambiar_a_ganada_sincroniza_propiedad(session)
            test_cambiar_a_perdida_requiere_motivo(session)
            test_cambiar_a_ganada_requiere_monto_y_condiciones(session)
            test_flujo_completo_abierta_a_ganada(session)
            
            print("\n" + "="*80)
            print("✅ TODOS LOS TESTS PASARON - CRM Oportunidad Service")
            print("="*80 + "\n")
        except Exception as e:
            print(f"\n❌ ERROR EN TESTS: {e}")
            import traceback
            traceback.print_exc()
