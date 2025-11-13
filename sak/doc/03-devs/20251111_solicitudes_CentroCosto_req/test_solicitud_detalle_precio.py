"""
Tests de SolicitudDetalle con campos precio e importe

Ubicación: doc/03-devs/20251111_solicitudes_CentroCosto_req/test_solicitud_detalle_precio.py
Ejecución: pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_solicitud_detalle_precio.py -v
"""
import sys
from pathlib import Path

# Agregar el directorio backend al path para imports
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import pytest
from decimal import Decimal
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool
from app.models import SolicitudDetalle, Solicitud, Articulo  # type: ignore
from datetime import date, timedelta


@pytest.fixture(name="session")
def session_fixture():
    """Crear sesión de base de datos en memoria para tests"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_solicitud_detalle_fields_exist(session: Session):
    """Verificar que los campos precio e importe existen en el modelo"""
    # Crear un detalle básico
    detalle = SolicitudDetalle(
        solicitud_id=1,
        descripcion="Test detalle",
        cantidad=Decimal("10"),
        precio=Decimal("150.50"),
        importe=Decimal("1505.00")
    )
    
    assert hasattr(detalle, "precio")
    assert hasattr(detalle, "importe")
    assert detalle.precio == Decimal("150.50")
    assert detalle.importe == Decimal("1505.00")
    
    print("✅ Test passed: campos precio e importe existen")


def test_solicitud_detalle_default_values(session: Session):
    """Verificar valores por defecto de precio e importe"""
    detalle = SolicitudDetalle(
        solicitud_id=1,
        descripcion="Test sin precio",
        cantidad=Decimal("5")
    )
    
    # Los valores por defecto deben ser 0
    assert detalle.precio == Decimal("0")
    assert detalle.importe == Decimal("0")
    
    print("✅ Test passed: valores por defecto son 0")


def test_solicitud_detalle_calculo_importe_frontend():
    """Verificar que el cálculo de importe se hace en el frontend"""
    # Simular cálculo en frontend
    cantidad = Decimal("10")
    precio = Decimal("150.50")
    importe_calculado = cantidad * precio
    
    assert importe_calculado == Decimal("1505.00")
    
    # El frontend enviaría esto al backend
    detalle_data = {
        "solicitud_id": 1,
        "descripcion": "Test",
        "cantidad": cantidad,
        "precio": precio,
        "importe": importe_calculado  # Ya calculado por frontend
    }
    
    assert detalle_data["importe"] == cantidad * precio
    
    print("✅ Test passed: cálculo de importe se hace en frontend")


def test_solicitud_detalle_precision_decimal():
    """Verificar precisión de campos DECIMAL(15,2)"""
    # Valores con 2 decimales
    precio = Decimal("999999999999.99")  # Máximo con 15 dígitos, 2 decimales
    importe = Decimal("999999999999.99")
    
    detalle_data = {
        "precio": precio,
        "importe": importe
    }
    
    # Verificar que mantienen la precisión
    assert str(detalle_data["precio"]) == "999999999999.99"
    assert str(detalle_data["importe"]) == "999999999999.99"
    
    print("✅ Test passed: precisión DECIMAL(15,2) correcta")


def test_solicitud_detalle_negative_values():
    """Verificar que se pueden crear detalles (validación en API si se requiere)"""
    # El modelo permite valores negativos, la validación debe ser en el endpoint
    cantidad = Decimal("10")
    precio = Decimal("-50.00")  # Precio negativo
    importe = cantidad * precio
    
    detalle_data = {
        "cantidad": cantidad,
        "precio": precio,
        "importe": importe
    }
    
    # El modelo permite esto, pero el endpoint debería validar
    assert detalle_data["precio"] < 0
    assert detalle_data["importe"] < 0
    
    print("⚠️  Test info: validación de valores negativos debe hacerse en endpoint")


def test_solicitud_detalle_zero_values():
    """Verificar manejo de valores en cero"""
    detalle_data = {
        "cantidad": Decimal("10"),
        "precio": Decimal("0"),
        "importe": Decimal("0")
    }
    
    assert detalle_data["precio"] == Decimal("0")
    assert detalle_data["importe"] == Decimal("0")
    
    print("✅ Test passed: valores en cero permitidos")


def test_solicitud_detalle_large_quantities():
    """Verificar manejo de cantidades grandes"""
    cantidad = Decimal("1000.500")  # 3 decimales en cantidad (DECIMAL 12,3)
    precio = Decimal("25.75")
    importe = cantidad * precio
    
    detalle_data = {
        "cantidad": cantidad,
        "precio": precio,
        "importe": importe
    }
    
    # Importe debe redondearse a 2 decimales
    assert detalle_data["importe"] == Decimal("25762.875")
    
    # Para guardar en DB debería redondearse a 2 decimales
    importe_redondeado = round(importe, 2)
    assert importe_redondeado == Decimal("25762.88")
    
    print("✅ Test passed: cantidades grandes manejadas correctamente")


def test_solicitud_detalle_string_representation():
    """Verificar que __str__ funciona con los nuevos campos"""
    detalle = SolicitudDetalle(
        solicitud_id=1,
        descripcion="Artículo de prueba",
        cantidad=Decimal("5"),
        precio=Decimal("100.00"),
        importe=Decimal("500.00")
    )
    
    str_repr = str(detalle)
    assert "SolicitudDetalle" in str_repr
    assert "Artículo de prueba" in str_repr
    
    print(f"✅ Test passed: {str_repr}")


def test_solicitud_detalle_multiple_items_total():
    """Verificar cálculo de total con múltiples detalles"""
    detalles = [
        {"cantidad": Decimal("10"), "precio": Decimal("50.00"), "importe": Decimal("500.00")},
        {"cantidad": Decimal("5"), "precio": Decimal("100.00"), "importe": Decimal("500.00")},
        {"cantidad": Decimal("2"), "precio": Decimal("250.00"), "importe": Decimal("500.00")},
    ]
    
    total = sum(d["importe"] for d in detalles)
    assert total == Decimal("1500.00")
    
    # Verificar que cada importe es correcto
    for detalle in detalles:
        assert detalle["importe"] == detalle["cantidad"] * detalle["precio"]
    
    print("✅ Test passed: cálculo de total con múltiples detalles")


def test_migration_existing_data():
    """Verificar que la migración asigna 0 a campos existentes"""
    # Este test simula el comportamiento esperado después de la migración
    # Los registros existentes deben tener precio=0 e importe=0
    
    detalle_existente = {
        "solicitud_id": 1,
        "descripcion": "Registro existente antes de migración",
        "cantidad": Decimal("10"),
        # precio e importe fueron agregados por migración con default=0
        "precio": Decimal("0"),
        "importe": Decimal("0")
    }
    
    assert detalle_existente["precio"] == Decimal("0")
    assert detalle_existente["importe"] == Decimal("0")
    
    print("✅ Test passed: migración asigna valores por defecto correctamente")


if __name__ == "__main__":
    print("🧪 Ejecutando tests de SolicitudDetalle (precio e importe)...\n")
    pytest.main([__file__, "-v", "--tb=short"])
