import requests

try:
    response = requests.get('http://localhost:8000/items')
    print(f"Status: {response.status_code}")
    print(f"Content-Range header: {response.headers.get('Content-Range', 'NOT FOUND')}")
    print(f"Access-Control-Expose-Headers: {response.headers.get('Access-Control-Expose-Headers', 'NOT FOUND')}")
    print("All headers:")
    for key, value in response.headers.items():
        print(f"  {key}: {value}")
except Exception as e:
    print(f"Error: {e}")
