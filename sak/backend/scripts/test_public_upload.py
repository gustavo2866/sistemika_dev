#!/usr/bin/env python3
"""
Test de upload público de PDF
"""

import os
import sys
from pathlib import Path
from io import BytesIO

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

print("=" * 60)
print("🧪 TEST DE UPLOAD PÚBLICO DE PDF")
print("=" * 60)

try:
    # Crear PDF de prueba
    test_content = b"%PDF-1.4\nTest PDF content"
    test_file = BytesIO(test_content)
    
    print("\n1️⃣ Subiendo PDF con type=upload (público)...")
    result = cloudinary.uploader.upload(
        test_file,
        folder="sak_files/facturas",
        public_id="test_public_pdf",
        resource_type="raw",
        type="upload",
        use_filename=True,
        unique_filename=True
    )
    
    print(f"   ✅ Upload exitoso!")
    print(f"   Public ID: {result['public_id']}")
    print(f"   URL: {result['secure_url']}")
    print(f"\n2️⃣ Intenta abrir esta URL en tu navegador:")
    print(f"   {result['secure_url']}")
    print(f"\n   Si da error 401, necesitas configurar tu cuenta:")
    print(f"   https://console.cloudinary.com/settings/security")
    print(f"   Asegúrate de que 'Raw' NO esté en 'Restricted media types'")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
