import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def test_dataProvider_contract():
    print("=== TESTING DATAPROVIDER CONTRACT ===\n")
    
    # Test 1: Health check
    print("1. Testing health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    print("   ✅ Health check passed\n")
    
    # Test 2: List items with dataProvider format
    print("2. Testing GET /items (dataProvider format)...")
    response = requests.get(f"{BASE_URL}/items")
    print(f"   Status: {response.status_code}")
    data = response.json()
    print(f"   Response keys: {list(data.keys())}")
    assert response.status_code == 200
    assert "data" in data
    assert "total" in data
    assert isinstance(data["data"], list)
    assert isinstance(data["total"], int)
    print(f"   Items: {len(data['data'])}, Total: {data['total']}")
    print("   ✅ List format correct\n")
    
    # Test 3: Create with dataProvider format
    print("3. Testing POST /items (dataProvider format)...")
    new_item_data = {
        "name": "Item DataProvider Test",
        "description": "Test del contrato dataProvider"
    }
    response = requests.post(
        f"{BASE_URL}/items",
        headers={"Content-Type": "application/json"},
        json=new_item_data
    )
    print(f"   Status: {response.status_code}")
    created_data = response.json()
    print(f"   Response keys: {list(created_data.keys())}")
    assert response.status_code == 201
    assert "data" in created_data
    item = created_data["data"]
    assert "id" in item
    assert "created_at" in item
    assert "updated_at" in item
    assert "deleted_at" in item
    assert "version" in item
    assert item["version"] == 1
    assert item["name"] == new_item_data["name"]
    print(f"   Created item ID: {item['id']}, Version: {item['version']}")
    print("   ✅ Create format correct\n")
    
    item_id = item["id"]
    
    # Test 4: Get by ID with dataProvider format
    print(f"4. Testing GET /items/{item_id} (dataProvider format)...")
    response = requests.get(f"{BASE_URL}/items/{item_id}")
    print(f"   Status: {response.status_code}")
    get_data = response.json()
    assert response.status_code == 200
    assert "data" in get_data
    retrieved_item = get_data["data"]
    assert retrieved_item["id"] == item_id
    print(f"   Retrieved: {retrieved_item['name']}")
    print("   ✅ Get format correct\n")
    
    # Test 5: Pagination
    print("5. Testing pagination (page/perPage)...")
    response = requests.get(f"{BASE_URL}/items?page=1&perPage=2")
    print(f"   Status: {response.status_code}")
    page_data = response.json()
    assert response.status_code == 200
    assert len(page_data["data"]) <= 2
    print(f"   Page 1 items: {len(page_data['data'])}")
    print("   ✅ Pagination working\n")
    
    # Test 6: Sorting
    print("6. Testing sorting (sortBy/sortDir)...")
    response = requests.get(f"{BASE_URL}/items?sortBy=created_at&sortDir=desc")
    print(f"   Status: {response.status_code}")
    sort_data = response.json()
    assert response.status_code == 200
    if len(sort_data["data"]) > 1:
        first_item = sort_data["data"][0]
        second_item = sort_data["data"][1]
        assert first_item["created_at"] >= second_item["created_at"]
    print("   ✅ Sorting working\n")
    
    # Test 7: Text search filter
    print("7. Testing text search filter (q)...")
    filter_data = {"q": "DataProvider"}
    filter_json = json.dumps(filter_data)
    response = requests.get(f"{BASE_URL}/items?filter={filter_json}")
    print(f"   Status: {response.status_code}")
    search_data = response.json()
    assert response.status_code == 200
    found_items = [item for item in search_data["data"] if "DataProvider" in item.get("description", "")]
    print(f"   Found {len(found_items)} items with 'DataProvider'")
    print("   ✅ Text search working\n")
    
    # Test 8: Range filter
    print("8. Testing range filter...")
    filter_data = {"version": {"gte": 1}}
    filter_json = json.dumps(filter_data)
    response = requests.get(f"{BASE_URL}/items?filter={filter_json}")
    print(f"   Status: {response.status_code}")
    range_data = response.json()
    assert response.status_code == 200
    print(f"   Items with version >= 1: {len(range_data['data'])}")
    print("   ✅ Range filter working\n")
    
    # Test 9: Update with version (optimistic locking)
    print("9. Testing PUT with version (optimistic locking)...")
    current_version = retrieved_item["version"]
    update_data = {
        "name": "Updated with version",
        "description": "Updated description",
        "version": current_version
    }
    response = requests.put(
        f"{BASE_URL}/items/{item_id}",
        headers={"Content-Type": "application/json"},
        json=update_data
    )
    print(f"   Status: {response.status_code}")
    update_response = response.json()
    assert response.status_code == 200
    assert "data" in update_response
    updated_item = update_response["data"]
    assert updated_item["version"] == current_version + 1
    assert updated_item["name"] == update_data["name"]
    print(f"   Version updated: {current_version} -> {updated_item['version']}")
    print("   ✅ Optimistic locking working\n")
    
    # Test 10: Version conflict
    print("10. Testing version conflict...")
    old_version_data = {
        "name": "Should fail",
        "version": current_version  # Version anterior
    }
    response = requests.put(
        f"{BASE_URL}/items/{item_id}",
        headers={"Content-Type": "application/json"},
        json=old_version_data
    )
    print(f"   Status: {response.status_code}")
    assert response.status_code == 409  # Conflict
    conflict_data = response.json()
    # FastAPI envuelve en detail, pero nuestro error está ahí
    error_data = conflict_data.get("detail", conflict_data)
    if "error" in error_data:
        error_data = error_data["error"]
    assert error_data["code"] == "CONFLICT"
    print("   ✅ Version conflict detected\n")
    
    # Test 11: Soft delete
    print("11. Testing soft delete...")
    response = requests.delete(f"{BASE_URL}/items/{item_id}?hard=false")
    print(f"   Status: {response.status_code}")
    delete_response = response.json()
    assert response.status_code == 200
    assert "data" in delete_response
    assert delete_response["data"] == True
    print("   ✅ Soft delete working\n")
    
    # Test 12: Verify soft delete (should not appear in normal list)
    print("12. Testing soft delete exclusion...")
    response = requests.get(f"{BASE_URL}/items?deleted=exclude")
    exclude_data = response.json()
    soft_deleted_items = [item for item in exclude_data["data"] if item["id"] == item_id]
    assert len(soft_deleted_items) == 0
    print("   Item not in exclude list ✅")
    
    # Test 13: Include deleted items
    response = requests.get(f"{BASE_URL}/items?deleted=include")
    include_data = response.json()
    all_items = [item for item in include_data["data"] if item["id"] == item_id]
    assert len(all_items) == 1
    assert all_items[0]["deleted_at"] is not None
    print("   Item appears in include list with deleted_at ✅")
    print("   ✅ Soft delete verification complete\n")
    
    # Test 14: Error format
    print("14. Testing error format...")
    response = requests.get(f"{BASE_URL}/items/99999")  # Non-existent ID
    print(f"   Status: {response.status_code}")
    error_data = response.json()
    assert response.status_code == 404
    # Manejar estructura de error envuelta por FastAPI
    error_detail = error_data.get("detail", error_data)
    if "error" in error_detail:
        error_detail = error_detail["error"]
    assert "code" in error_detail
    assert "message" in error_detail
    assert error_detail["code"] == "NOT_FOUND"
    print("   ✅ Error format correct\n")
    
    print("🎉 ALL DATAPROVIDER CONTRACT TESTS PASSED! 🎉")

if __name__ == "__main__":
    try:
        test_dataProvider_contract()
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
