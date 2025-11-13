"""
Tests de modelo CentroCosto

Ubicación: doc/03-devs/20251111_solicitudes_CentroCosto_req/test_centro_costo_models.py
Ejecución: pytest doc/03-devs/20251111_solicitudes_CentroCosto_req/test_centro_costo_models.py -v
"""
import sys
from pathlib import Path

# Agregar el directorio backend al path para imports
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import pytest
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy.pool import StaticPool
from app.models import CentroCosto  # type: ignore


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


def test_create_centro_costo_general(session: Session):
    """Crear centro de costo tipo General"""
    centro = CentroCosto(
        nombre="Test General",
        tipo="General",
        codigo_contable="TEST-001",
        activo=True
    )
    session.add(centro)
    session.commit()
    session.refresh(centro)
    
    assert centro.id is not None
    assert centro.nombre == "Test General"
    assert centro.tipo == "General"
    assert centro.activo is True
    assert centro.codigo_contable == "TEST-001"
    print(f"✅ Test passed: {centro}")


def test_create_centro_costo_proyecto(session: Session):
    """Crear centro de costo tipo Proyecto"""
    centro = CentroCosto(
        nombre="CC Proyecto Test",
        tipo="Proyecto",
        codigo_contable="PROY-001",
        descripcion="Centro de costo para proyecto de prueba",
        activo=True
    )
    session.add(centro)
    session.commit()
    session.refresh(centro)
    
    assert centro.tipo == "Proyecto"
    assert centro.descripcion == "Centro de costo para proyecto de prueba"
    print(f"✅ Test passed: {centro}")


def test_create_centro_costo_propiedad(session: Session):
    """Crear centro de costo tipo Propiedad"""
    centro = CentroCosto(
        nombre="CC Propiedad Test",
        tipo="Propiedad",
        codigo_contable="PROP-001",
        descripcion="Centro de costo para propiedad de prueba",
        activo=True
    )
    session.add(centro)
    session.commit()
    session.refresh(centro)
    
    assert centro.tipo == "Propiedad"
    print(f"✅ Test passed: {centro}")


def test_unique_nombre(session: Session):
    """Verificar que nombre es único"""
    centro1 = CentroCosto(
        nombre="Test Unique",
        tipo="General",
        codigo_contable="TEST-001",
        activo=True
    )
    session.add(centro1)
    session.commit()
    
    # Intentar crear otro con el mismo nombre debe fallar
    centro2 = CentroCosto(
        nombre="Test Unique",  # Mismo nombre
        tipo="General",
        codigo_contable="TEST-002",
        activo=True
    )
    session.add(centro2)
    
    with pytest.raises(Exception):  # IntegrityError en SQLAlchemy
        session.commit()
    
    print("✅ Test passed: nombre único validado correctamente")


def test_codigo_contable_not_unique(session: Session):
    """Verificar que codigo_contable NO es único (puede repetirse)"""
    centro1 = CentroCosto(
        nombre="Test 1",
        tipo="General",
        codigo_contable="SHARED-001",
        activo=True
    )
    session.add(centro1)
    session.commit()
    session.refresh(centro1)
    
    centro2 = CentroCosto(
        nombre="Test 2",
        tipo="General",
        codigo_contable="SHARED-001",  # Mismo código
        activo=True
    )
    session.add(centro2)
    session.commit()  # No debe fallar
    session.refresh(centro2)
    
    assert centro1.codigo_contable == centro2.codigo_contable
    assert centro1.nombre != centro2.nombre
    print(f"✅ Test passed: codigo_contable puede duplicarse")


def test_activo_field(session: Session):
    """Verificar campo activo"""
    centro = CentroCosto(
        nombre="Test Activo",
        tipo="General",
        codigo_contable="ACT-001",
        activo=True
    )
    session.add(centro)
    session.commit()
    session.refresh(centro)
    
    assert centro.activo is True
    
    # Cambiar a inactivo
    centro.activo = False
    session.commit()
    session.refresh(centro)
    
    assert centro.activo is False
    print("✅ Test passed: campo activo funciona correctamente")


def test_descripcion_opcional(session: Session):
    """Verificar que descripcion es opcional"""
    centro = CentroCosto(
        nombre="Test Sin Descripcion",
        tipo="General",
        codigo_contable="SIN-DESC-001",
        activo=True
    )
    session.add(centro)
    session.commit()
    session.refresh(centro)
    
    assert centro.descripcion is None
    print("✅ Test passed: descripcion es opcional")


def test_str_representation(session: Session):
    """Verificar representación en string"""
    centro = CentroCosto(
        nombre="Test String",
        tipo="General",
        codigo_contable="STR-001",
        activo=True
    )
    session.add(centro)
    session.commit()
    session.refresh(centro)
    
    str_repr = str(centro)
    assert "CentroCosto" in str_repr
    assert "Test String" in str_repr
    assert "General" in str_repr
    print(f"✅ Test passed: {str_repr}")


if __name__ == "__main__":
    print("🧪 Ejecutando tests de modelo CentroCosto...\n")
    pytest.main([__file__, "-v", "--tb=short"])
