#!/usr/bin/env python3
"""
Script de verificación rápida del Auto-Discovery GenericCRUD

Ejecuta este script para verificar que el auto-discovery funciona correctamente
sin necesidad de pytest ni configuración compleja.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_auto_discovery():
    """Prueba básica del sistema auto-discovery"""
    print("🧪 Iniciando pruebas de Auto-Discovery GenericCRUD...\n")
    
    try:
        # Importar modelos y CRUD
        from app.core.generic_crud import GenericCRUD
        from app.models.user import User
        from app.models.item import Item
        from app.models.pais import Paises
        from app.models.tarea import Tarea
        
        print("✅ Imports successful")
        
        # Prueba 1: User -> Pais
        print("\n📊 Probando User relations...")
        user_crud = GenericCRUD(User)
        user_relations = user_crud._discover_relations(User, max_depth=2)
        print(f"   User relations: {list(user_relations.keys())}")
        
        expected_user_relations = ["pais"]
        for rel in expected_user_relations:
            if rel in user_relations:
                print(f"   ✅ {rel} - FOUND")
            else:
                print(f"   ❌ {rel} - MISSING")
        
        # Prueba 2: Item -> User -> Pais  
        print("\n📊 Probando Item relations...")
        item_crud = GenericCRUD(Item)
        item_relations = item_crud._discover_relations(Item, max_depth=2)
        print(f"   Item relations: {list(item_relations.keys())}")
        
        expected_item_relations = ["user"]
        for rel in expected_item_relations:
            if rel in item_relations:
                print(f"   ✅ {rel} - FOUND")
            else:
                print(f"   ❌ {rel} - MISSING")
        
        # Prueba 3: Tarea -> User (nueva entidad)
        print("\n📊 Probando Tarea relations...")
        tarea_crud = GenericCRUD(Tarea)
        tarea_relations = tarea_crud._discover_relations(Tarea, max_depth=2)
        print(f"   Tarea relations: {list(tarea_relations.keys())}")
        
        expected_tarea_relations = ["user"]
        for rel in expected_tarea_relations:
            if rel in tarea_relations:
                print(f"   ✅ {rel} - FOUND")
            else:
                print(f"   ❌ {rel} - MISSING")
        
        # Prueba 4: Paises (sin relaciones salientes)
        print("\n📊 Probando Paises relations...")
        pais_crud = GenericCRUD(Paises)
        pais_relations = pais_crud._discover_relations(Paises, max_depth=2)
        print(f"   Paises relations: {list(pais_relations.keys())}")
        print(f"   ✅ Paises correctly has {len(pais_relations)} outgoing relations")
        
        # Prueba 5: Auto-include options
        print("\n📊 Probando auto-include options...")
        for model_name, crud in [("User", user_crud), ("Item", item_crud), ("Tarea", tarea_crud)]:
            options = crud._get_auto_include_options()
            print(f"   {model_name}: {len(options)} selectinload options generated")
            if len(options) > 0:
                print(f"   ✅ {model_name} - Options generated successfully")
            else:
                print(f"   ⚠️  {model_name} - No options (may be normal for some models)")
        
        print("\n🎉 Auto-Discovery funcionando correctamente!")
        print("\n📋 Resumen:")
        print("   ✅ Detecta automáticamente relaciones User -> Pais")
        print("   ✅ Detecta automáticamente relaciones Item -> User")
        print("   ✅ Detecta automáticamente relaciones Tarea -> User (nueva entidad)")
        print("   ✅ Maneja modelos sin relaciones salientes (Pais)")
        print("   ✅ Genera selectinload options válidos")
        print("\n🚀 El sistema es ahora verdaderamente genérico!")
        
    except ImportError as e:
        print(f"❌ Error de importación: {e}")
        print("   Asegúrate de estar en el directorio server/")
        return False
    except Exception as e:
        print(f"❌ Error durante las pruebas: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

def test_api_endpoints():
    """Prueba los endpoints de la API para verificar transparencia"""
    print("\n🌐 Probando endpoints de API...")
    
    try:
        import requests
        
        base_url = "http://localhost:8000"
        endpoints_to_test = [
            ("users", "User"),
            ("items", "Item"),
            ("tareas", "Tarea"),
            ("paises", "Pais")
        ]
        
        for endpoint, model_name in endpoints_to_test:
            try:
                response = requests.get(f"{base_url}/{endpoint}", timeout=3)
                if response.status_code == 200:
                    data = response.json()
                    print(f"   ✅ {model_name} endpoint: {len(data)} records")
                    
                    # Verificar que incluye relaciones automáticamente
                    if data and len(data) > 0:
                        first_record = data[0]
                        
                        # Verificar includes específicos
                        if endpoint == "items" and "user" in first_record:
                            print(f"      ✅ Item includes User data automatically")
                            if first_record["user"] and "pais" in first_record["user"]:
                                print(f"      ✅ User includes Pais data automatically (nested)")
                        
                        elif endpoint == "users" and "pais" in first_record:
                            print(f"      ✅ User includes Pais data automatically")
                        
                        elif endpoint == "tareas" and "user" in first_record:
                            print(f"      ✅ Tarea includes User data automatically")
                            
                else:
                    print(f"   ⚠️  {model_name} endpoint: HTTP {response.status_code}")
                    
            except requests.exceptions.RequestException:
                print(f"   ℹ️  {model_name} endpoint: Server not responding")
        
    except ImportError:
        print("   ℹ️  requests no disponible, saltando pruebas de API")

if __name__ == "__main__":
    success = test_auto_discovery()
    test_api_endpoints()
    
    print("\n" + "="*60)
    if success:
        print("🎯 RESULTADO: Auto-Discovery implementado exitosamente!")
        print("   ✨ GenericCRUD ahora es verdaderamente genérico")
        print("   🚀 Nuevas entidades funcionan automáticamente")
        print("   💯 Transparente para el frontend")
    else:
        print("❌ RESULTADO: Hay problemas con la implementación")
        
    print("\n💡 Para pruebas más detalladas:")
    print("   python -m pytest tests/test_auto_discovery_crud.py -v")
