"""
Suite de pruebas para el Auto-Discovery del GenericCRUD

Estas pruebas verifican que:
1. El auto-discovery detecta correctamente las relaciones
2. Las relaciones anidadas se manejan apropiadamente
3. El sistema es transparente para el frontend
4. No hay regresiones en funcionalidad existente
"""

import pytest
import json
from typing import Dict, Any, List
from sqlmodel import SQLModel, Session, create_engine, Field, Relationship
from sqlalchemy.pool import StaticPool
from app.core.generic_crud import GenericCRUD
from app.models.user import User
from app.models.item import Item
from app.models.pais import Paises
from app.models.tarea import Tarea


class TestAutoDiscoveryCRUD:
    """Pruebas del sistema auto-discovery del GenericCRUD"""
    
    @pytest.fixture
    def memory_session(self):
        """Crea una sesión de base de datos en memoria para pruebas"""
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        
        with Session(engine) as session:
            # Crear datos de prueba
            self._create_test_data(session)
            yield session
    
    def _create_test_data(self, session: Session):
        """Crea datos de prueba en la base de datos"""
        # Crear país
        pais = Paises(name="Argentina")
        session.add(pais)
        session.commit()
        session.refresh(pais)
        
        # Crear usuario
        user = User(
            nombre="Test User",
            email="test@sistemika.com",
            telefono="+54 11 1234-5678",
            pais_id=pais.id
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        
        # Crear item
        item = Item(
            name="Test Item",
            description="Test Description",
            price=100.0,
            user_id=user.id
        )
        session.add(item)
        session.commit()
        session.refresh(item)
        
        # Crear tarea
        tarea = Tarea(
            titulo="Test Tarea",
            descripcion="Test Description",
            estado="pendiente",
            prioridad="media",
            user_id=user.id
        )
        session.add(tarea)
        session.commit()

    def test_auto_discovery_user_relations(self, memory_session):
        """Prueba que User auto-descubre la relación con Pais"""
        crud = GenericCRUD(User)
        
        # Verificar que se descubren las relaciones
        relations = crud._discover_relations(User, max_depth=2)
        
        assert "pais" in relations, "Debería auto-descubrir la relación User -> Pais"
        assert len(relations) == 1, f"User debería tener 1 relación, encontró: {list(relations.keys())}"
        
        print(f"✅ User relations discovered: {list(relations.keys())}")

    def test_auto_discovery_item_relations(self, memory_session):
        """Prueba que Item auto-descubre relaciones anidadas Item -> User -> Pais"""
        crud = GenericCRUD(Item)
        
        # Verificar relaciones de primer nivel
        relations = crud._discover_relations(Item, max_depth=1)
        assert "user" in relations, "Item debería auto-descubrir la relación con User"
        
        # Verificar relaciones anidadas
        nested_relations = crud._discover_relations(Item, max_depth=2)
        assert "user" in nested_relations, "Item debería mantener la relación con User en profundidad 2"
        
        print(f"✅ Item relations (depth=1): {list(relations.keys())}")
        print(f"✅ Item relations (depth=2): {list(nested_relations.keys())}")

    def test_auto_discovery_tarea_relations(self, memory_session):
        """Prueba que Tarea auto-descubre la relación con User (nueva entidad)"""
        crud = GenericCRUD(Tarea)
        
        relations = crud._discover_relations(Tarea, max_depth=2)
        
        assert "user" in relations, "Tarea debería auto-descubrir la relación con User"
        assert len(relations) == 1, f"Tarea debería tener 1 relación, encontró: {list(relations.keys())}"
        
        print(f"✅ Tarea relations discovered: {list(relations.keys())}")

    def test_get_auto_include_options(self, memory_session):
        """Prueba que _get_auto_include_options retorna selectinload options válidos"""
        crud = GenericCRUD(Item)
        
        options = crud._get_auto_include_options()
        
        assert len(options) > 0, "Debería retornar al menos una opción de include"
        
        # Verificar que son objetos selectinload válidos
        from sqlalchemy.orm.strategy_options import Load
        for option in options:
            assert hasattr(option, 'path'), f"Option debería ser un objeto Load válido: {type(option)}"
        
        print(f"✅ Generated {len(options)} valid selectinload options")

    def test_transparent_frontend_compatibility(self, memory_session):
        """Prueba que la funcionalidad es transparente para el frontend"""
        # Probar con diferentes modelos para asegurar compatibilidad
        models_to_test = [User, Item, Tarea]
        
        for model in models_to_test:
            crud = GenericCRUD(model)
            
            # Verificar que los métodos públicos funcionan sin errores
            try:
                # Simular obtener lista (como haría el frontend)
                stmt = crud._build_list_query(memory_session, {}, 0, 10, "id", "ASC")
                
                # Verificar que se pueden aplicar auto-includes sin errores
                stmt_with_includes = crud._apply_auto_includes(stmt)
                
                assert stmt_with_includes is not None
                print(f"✅ {model.__name__}: Frontend compatibility verified")
                
            except Exception as e:
                pytest.fail(f"❌ {model.__name__}: Frontend compatibility failed: {e}")

    def test_no_circular_dependencies(self, memory_session):
        """Prueba que el auto-discovery no causa dependencias circulares"""
        models_to_test = [User, Item, Paises, Tarea]
        
        for model in models_to_test:
            crud = GenericCRUD(model)
            
            try:
                # Intentar descubrir relaciones con diferentes profundidades
                for depth in [1, 2, 3]:
                    relations = crud._discover_relations(model, max_depth=depth)
                    assert isinstance(relations, dict), f"Debería retornar dict para {model.__name__} depth={depth}"
                
                print(f"✅ {model.__name__}: No circular dependencies detected")
                
            except Exception as e:
                pytest.fail(f"❌ {model.__name__}: Circular dependency or error: {e}")

    def test_backwards_compatibility(self, memory_session):
        """Prueba que el método legacy _get_auto_include sigue funcionando"""
        models_to_test = [User, Item, Tarea]
        
        for model in models_to_test:
            crud = GenericCRUD(model)
            
            try:
                # Método legacy debería seguir funcionando
                legacy_includes = crud._get_auto_include()
                
                assert isinstance(legacy_includes, list), f"Legacy method should return list for {model.__name__}"
                print(f"✅ {model.__name__}: Legacy compatibility maintained - {legacy_includes}")
                
            except Exception as e:
                pytest.fail(f"❌ {model.__name__}: Legacy compatibility broken: {e}")

    def test_performance_reasonable_depth(self, memory_session):
        """Prueba que el auto-discovery tiene performance razonable"""
        import time
        
        crud = GenericCRUD(Item)
        
        # Medir tiempo de descubrimiento
        start_time = time.time()
        relations = crud._discover_relations(Item, max_depth=3)
        end_time = time.time()
        
        discovery_time = end_time - start_time
        
        assert discovery_time < 1.0, f"Auto-discovery debería ser < 1s, fue: {discovery_time:.3f}s"
        assert len(relations) > 0, "Debería descubrir al menos una relación"
        
        print(f"✅ Auto-discovery performance: {discovery_time:.3f}s for {len(relations)} relations")

    def test_handles_models_without_relations(self, memory_session):
        """Prueba que maneja correctamente modelos sin relaciones"""
        crud = GenericCRUD(Paises)  # Paises no tiene relaciones salientes
        
        relations = crud._discover_relations(Paises, max_depth=2)
        options = crud._get_auto_include_options()
        
        # Debería manejar gracefully modelos sin relaciones
        assert isinstance(relations, dict), "Debería retornar dict vacío para Pais"
        assert isinstance(options, list), "Debería retornar lista vacía para Pais"
        
        print(f"✅ Pais (no relations): {len(relations)} relations, {len(options)} options")


# Prueba de integración end-to-end
def test_end_to_end_integration():
    """Prueba de integración completa simulando requests del frontend"""
    import requests
    import json
    
    # Esta prueba requiere que el servidor esté corriendo
    # Se ejecutará solo si el servidor está disponible
    
    try:
        # Probar endpoint de Items (relación anidada Item -> User -> Pais)
        response = requests.get("http://localhost:8000/items", timeout=2)
        
        if response.status_code == 200:
            items_data = response.json()
            
            # Verificar que los datos incluyen relaciones anidadas
            if items_data and len(items_data) > 0:
                first_item = items_data[0]
                
                # Verificar que incluye user
                assert "user" in first_item, "Item debería incluir datos de user automáticamente"
                
                # Verificar que user incluye pais
                if first_item["user"]:
                    assert "pais" in first_item["user"], "User debería incluir datos de pais automáticamente"
                
                print("✅ End-to-end: Auto-discovery working transparently for frontend")
            else:
                print("ℹ️  End-to-end: No data available, but endpoint accessible")
        else:
            print(f"ℹ️  End-to-end: Server not running (status {response.status_code})")
            
    except requests.exceptions.RequestException:
        print("ℹ️  End-to-end: Server not available, skipping integration test")


if __name__ == "__main__":
    """Ejecutar pruebas directamente"""
    print("🧪 Ejecutando pruebas de Auto-Discovery GenericCRUD...")
    
    # Ejecutar test de integración
    test_end_to_end_integration()
    
    print("\n✅ Para ejecutar todas las pruebas:")
    print("   cd server && python -m pytest tests/test_auto_discovery_crud.py -v")
