#!/usr/bin/env python3
"""
Test de upload con URLs firmadas
"""

import os
import sys
from pathlib import Path
from io import BytesIO

# Agregar el directorio padre al path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
import cloudinary.utils

# Cargar .env
load_dotenv()

# Configurar cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

print("=" * 60)
print("🧪 TEST DE UPLOAD CON URL FIRMADA")
print("=" * 60)

try:
    # Crear archivo de prueba
    test_content = b"Test PDF content"
    test_file = BytesIO(test_content)
    
    print("\n1️⃣ Subiendo archivo con type=authenticated...")
    result = cloudinary.uploader.upload(
        test_file,
        folder="sak_files/facturas",
        public_id="test_authenticated",
        resource_type="raw",
        type="authenticated",
        use_filename=True,
        unique_filename=True
    )
    
    print(f"   ✅ Upload exitoso!")
    print(f"   Public ID: {result['public_id']}")
    print(f"   URL original: {result['secure_url']}")
    
    # Generar URL firmada
    print("\n2️⃣ Generando URL firmada...")
    import time
    signed_url = cloudinary.utils.cloudinary_url(
        result["public_id"],
        resource_type="raw",
        type="authenticated",
        sign_url=True,
        secure=True,
        expires_at=int(time.time()) + 31536000  # 1 año
    )[0]
    
    print(f"   ✅ URL firmada generada!")
    print(f"   URL: {signed_url}")
    
    print("\n3️⃣ Prueba acceder a esta URL en tu navegador")
    print(f"   {signed_url}")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
