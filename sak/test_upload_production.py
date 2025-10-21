import requests
import os
from pathlib import Path

# Buscar un PDF en Descargas
downloads_path = Path.home() / "Downloads"
pdf_files = list(downloads_path.glob("*.pdf"))

if not pdf_files:
    print("❌ No se encontró ningún PDF en Descargas")
    exit(1)

pdf_file = pdf_files[0]
print(f"📄 Usando archivo: {pdf_file.name}")
print("📤 Subiendo a producción...")

url = "https://sak-backend-94464199991.us-central1.run.app/api/v1/facturas/parse-pdf/"

try:
    with open(pdf_file, 'rb') as f:
        files = {'file': (pdf_file.name, f, 'application/pdf')}
        response = requests.post(url, files=files, timeout=60)
    
    print(f"\n✅ Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("\n✅ Upload exitoso!")
        import json
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"\n❌ Error: {e}")
