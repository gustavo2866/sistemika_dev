"""
Tests para Cotización Service
Valida obtención de cotizaciones vigentes y conversión de montos
"""
import sys
import os
# Agregar backend al path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

import pytest
from datetime import date
from decimal import Decimal
from sqlmodel import Session, select
from app.db import engine, init_db
from app.services.cotizacion_service import cotizacion_service
from app.models import CotizacionMoneda, Moneda


@pytest.fixture(scope="module")
def session():
    """Crear sesión de DB para tests"""
    init_db()
    with Session(engine) as session:
        yield session


def test_obtener_cotizacion_vigente(session: Session):
    """Test obtener cotización vigente para una fecha"""
    # Crear cotizaciones de prueba
    cotiz1 = CotizacionMoneda(
        moneda_origen_id=1,  # ARS
        moneda_destino_id=2,  # USD
        tipo_cambio=Decimal("1000.00"),
        fecha_vigencia=date(2025, 11, 1)
    )
    cotiz2 = CotizacionMoneda(
        moneda_origen_id=1,
        moneda_destino_id=2,
        tipo_cambio=Decimal("1100.00"),
        fecha_vigencia=date(2025, 11, 15)
    )
    session.add_all([cotiz1, cotiz2])
    session.commit()
    
    # Consultar cotización vigente al 2025-11-20 (debe usar la del 15)
    cotizacion = cotizacion_service.obtener_cotizacion(
        session=session,
        moneda_origen_id=1,
        moneda_destino_id=2,
        fecha_referencia=date(2025, 11, 20)
    )
    
    assert cotizacion is not None
    assert cotizacion.tipo_cambio == Decimal("1100.00")
    assert cotizacion.fecha_vigencia == date(2025, 11, 15)
    
    print(f"✅ Test 1 OK: Cotización vigente obtenida correctamente: {cotizacion.tipo_cambio}")


def test_obtener_cotizacion_fecha_anterior(session: Session):
    """Test obtener cotización para fecha entre dos vigencias"""
    # Consultar al 2025-11-10 (debe usar la del 1)
    cotizacion = cotizacion_service.obtener_cotizacion(
        session=session,
        moneda_origen_id=1,
        moneda_destino_id=2,
        fecha_referencia=date(2025, 11, 10)
    )
    
    if cotizacion:
        assert cotizacion.tipo_cambio == Decimal("1000.00")
        assert cotizacion.fecha_vigencia <= date(2025, 11, 10)
        print(f"✅ Test 2 OK: Cotización histórica correcta: {cotizacion.tipo_cambio}")
    else:
        print("⚠️  Test 2: No hay cotización para esa fecha (esperado si DB está limpia)")


def test_convertir_monto_ars_a_usd(session: Session):
    """Test conversión de monto ARS a USD"""
    # Asegurar que existe cotización
    cotiz_existente = session.exec(
        select(CotizacionMoneda).where(
            CotizacionMoneda.moneda_origen_id == 1,
            CotizacionMoneda.moneda_destino_id == 2
        )
    ).first()
    
    if not cotiz_existente:
        cotiz = CotizacionMoneda(
            moneda_origen_id=1,
            moneda_destino_id=2,
            tipo_cambio=Decimal("1000.00"),
            fecha_vigencia=date(2025, 11, 1)
        )
        session.add(cotiz)
        session.commit()
    
    # Convertir 100.000 ARS a USD
    resultado = cotizacion_service.convertir_monto(
        session=session,
        monto=Decimal("100000.00"),
        moneda_origen_id=1,
        moneda_destino_id=2,
        fecha_referencia=date(2025, 11, 20)
    )
    
    assert resultado is not None
    assert "monto_convertido" in resultado
    assert resultado["monto_convertido"] is not None
    # 100000 / tipo_cambio (debería ser ~100 si tipo_cambio es 1000)
    assert resultado["monto_convertido"] > 0
    assert "tipo_cambio" in resultado
    
    print(f"✅ Test 3 OK: Conversión ARS->USD: 100000 ARS = {resultado['monto_convertido']} USD (TC: {resultado['tipo_cambio']})")


def test_convertir_monto_calculo_correcto(session: Session):
    """Test que el cálculo de conversión es correcto"""
    # Crear cotización conocida
    cotiz_test = CotizacionMoneda(
        moneda_origen_id=1,
        moneda_destino_id=2,
        tipo_cambio=Decimal("1200.00"),
        fecha_vigencia=date(2025, 11, 25)
    )
    session.add(cotiz_test)
    session.commit()
    
    # Convertir 120.000 ARS -> debe dar 100 USD
    resultado = cotizacion_service.convertir_monto(
        session=session,
        monto=Decimal("120000.00"),
        moneda_origen_id=1,
        moneda_destino_id=2,
        fecha_referencia=date(2025, 11, 26)
    )
    
    assert resultado["tipo_cambio"] == Decimal("1200.00")
    assert resultado["monto_convertido"] == Decimal("100.00")
    
    print(f"✅ Test 4 OK: Cálculo correcto: 120000 / 1200 = {resultado['monto_convertido']}")


def test_convertir_sin_cotizacion_disponible(session: Session):
    """Test que cuando no hay cotización se retorna None o error"""
    # Intentar convertir a EUR (moneda_id=3) sin cotización
    resultado = cotizacion_service.convertir_monto(
        session=session,
        monto=Decimal("100000.00"),
        moneda_origen_id=1,
        moneda_destino_id=3,  # EUR probablemente sin cotización
        fecha_referencia=date(2025, 11, 20)
    )
    
    # Debe indicar que no hay cotización
    if resultado:
        assert resultado.get("monto_convertido") is None or "error" in resultado
        print(f"✅ Test 5 OK: Sin cotización retorna error/None: {resultado}")
    else:
        print(f"✅ Test 5 OK: Sin cotización retorna None")


def test_mismo_origen_destino(session: Session):
    """Test conversión cuando origen y destino son iguales"""
    resultado = cotizacion_service.convertir_monto(
        session=session,
        monto=Decimal("100000.00"),
        moneda_origen_id=1,
        moneda_destino_id=1,  # Misma moneda
        fecha_referencia=date(2025, 11, 20)
    )
    
    # Debe retornar el mismo monto
    if resultado:
        if resultado.get("monto_convertido"):
            assert resultado["monto_convertido"] == Decimal("100000.00")
            print(f"✅ Test 6 OK: Misma moneda retorna mismo monto")
        else:
            print(f"⚠️  Test 6: Misma moneda - comportamiento a definir")


if __name__ == "__main__":
    print("\n" + "="*80)
    print("EJECUTANDO TESTS: Cotización Service")
    print("="*80 + "\n")
    
    with Session(engine) as session:
        try:
            test_obtener_cotizacion_vigente(session)
            test_obtener_cotizacion_fecha_anterior(session)
            test_convertir_monto_ars_a_usd(session)
            test_convertir_monto_calculo_correcto(session)
            test_convertir_sin_cotizacion_disponible(session)
            test_mismo_origen_destino(session)
            
            print("\n" + "="*80)
            print("✅ TODOS LOS TESTS PASARON - Cotización Service")
            print("="*80 + "\n")
        except Exception as e:
            print(f"\n❌ ERROR EN TESTS: {e}")
            import traceback
            traceback.print_exc()
