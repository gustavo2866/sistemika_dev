import requests
import json

BASE_URL = "http://localhost:8000"

# Probar el conflicto de versión específicamente
print("Testing version conflict...")

# Primero obtener un item existente
response = requests.get(f"{BASE_URL}/items/4")
if response.status_code == 200:
    item = response.json()["data"]
    print(f"Current item version: {item['version']}")
    
    # Intentar actualizar con version anterior
    old_version_data = {
        "name": "Should fail",
        "version": item['version'] - 1  # Version anterior
    }
    
    print(f"Trying to update with version: {old_version_data['version']}")
    
    response = requests.put(
        f"{BASE_URL}/items/4",
        headers={"Content-Type": "application/json"},
        json=old_version_data
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    try:
        data = response.json()
        print(f"JSON data: {data}")
    except:
        print("No JSON response")
        
else:
    print(f"Failed to get item: {response.status_code}")
    print(response.text)
