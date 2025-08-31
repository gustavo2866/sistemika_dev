import requests
import json

BASE_URL = "http://localhost:8000"

def test_api():
    print("=== TESTING FASTAPI + SQLMODEL BACKEND ===\n")
    
    # Test 1: Health check
    print("1. Testing health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    print("   ✅ Health check passed\n")
    
    # Test 2: List items (initial)
    print("2. Testing GET /items (initial)...")
    response = requests.get(f"{BASE_URL}/items")
    print(f"   Status: {response.status_code}")
    initial_items = response.json()
    print(f"   Initial items count: {len(initial_items)}")
    assert response.status_code == 200
    print("   ✅ GET /items passed\n")
    
    # Test 3: Create new item
    print("3. Testing POST /items (create)...")
    new_item_data = {
        "name": "Item de prueba API",
        "description": "Descripción de prueba completa"
    }
    response = requests.post(
        f"{BASE_URL}/items",
        headers={"Content-Type": "application/json"},
        json=new_item_data
    )
    print(f"   Status: {response.status_code}")
    created_item = response.json()
    print(f"   Created item ID: {created_item['id']}")
    print(f"   Name: {created_item['name']}")
    assert response.status_code == 201
    assert created_item["name"] == new_item_data["name"]
    assert "id" in created_item
    assert "creado_en" in created_item
    assert "actualizado_en" in created_item
    print("   ✅ POST /items passed\n")
    
    item_id = created_item["id"]
    
    # Test 4: Get specific item
    print(f"4. Testing GET /items/{item_id} (get by id)...")
    response = requests.get(f"{BASE_URL}/items/{item_id}")
    print(f"   Status: {response.status_code}")
    retrieved_item = response.json()
    print(f"   Retrieved item: {retrieved_item['name']}")
    assert response.status_code == 200
    assert retrieved_item["id"] == item_id
    assert retrieved_item["name"] == new_item_data["name"]
    print("   ✅ GET /items/{id} passed\n")
    
    # Test 5: Update item
    print(f"5. Testing PATCH /items/{item_id} (update)...")
    update_data = {
        "description": "Descripción actualizada mediante PATCH"
    }
    response = requests.patch(
        f"{BASE_URL}/items/{item_id}",
        headers={"Content-Type": "application/json"},
        json=update_data
    )
    print(f"   Status: {response.status_code}")
    updated_item = response.json()
    print(f"   Updated description: {updated_item['description']}")
    assert response.status_code == 200
    assert updated_item["description"] == update_data["description"]
    assert updated_item["name"] == new_item_data["name"]  # should remain unchanged
    print("   ✅ PATCH /items/{id} passed\n")
    
    # Test 6: List items (after operations)
    print("6. Testing GET /items (after operations)...")
    response = requests.get(f"{BASE_URL}/items")
    print(f"   Status: {response.status_code}")
    final_items = response.json()
    print(f"   Final items count: {len(final_items)}")
    assert response.status_code == 200
    assert len(final_items) > len(initial_items)
    print("   ✅ GET /items (final) passed\n")
    
    # Test 7: Delete item
    print(f"7. Testing DELETE /items/{item_id} (delete)...")
    response = requests.delete(f"{BASE_URL}/items/{item_id}")
    print(f"   Status: {response.status_code}")
    assert response.status_code == 204
    print("   ✅ DELETE /items/{id} passed\n")
    
    # Test 8: Verify deletion
    print(f"8. Testing GET /items/{item_id} (should be 404)...")
    response = requests.get(f"{BASE_URL}/items/{item_id}")
    print(f"   Status: {response.status_code}")
    assert response.status_code == 404
    print("   ✅ Item deletion verified\n")
    
    print("🎉 ALL TESTS PASSED! Backend is working correctly! 🎉")

if __name__ == "__main__":
    try:
        test_api()
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
