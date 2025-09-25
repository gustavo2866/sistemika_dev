import requests
import json

try:
    # Probar el endpoint de salud
    health_response = requests.get("http://127.0.0.1:8000/health")
    print(f"Health endpoint: {health_response.status_code}")
    print(f"Health response: {health_response.json()}")
    
    # Probar el endpoint de usuarios
    users_response = requests.get("http://127.0.0.1:8000/users")
    print(f"Users endpoint: {users_response.status_code}")
    
    if users_response.status_code == 200:
        users_data = users_response.json()
        print(f"Users data type: {type(users_data)}")
        print(f"Users count: {len(users_data) if isinstance(users_data, list) else 'Not a list'}")
        print(f"Access-Control-Expose-Headers: {users_response.headers.get('Access-Control-Expose-Headers', 'Not found')}")
        print(f"Content-Range header: {users_response.headers.get('Content-Range', 'Not found')}")
        print(f"First user: {users_data[0] if users_data else 'No users'}")
    else:
        print(f"Error response: {users_response.text}")
        
except requests.exceptions.ConnectionError:
    print("ERROR: Cannot connect to backend - is it running?")
except Exception as e:
    print(f"ERROR: {e}")
