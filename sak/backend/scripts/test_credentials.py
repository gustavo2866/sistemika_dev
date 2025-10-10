#!/usr/bin/env python3
"""
Test directo de credenciales de Cloudinary
"""

import os
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
from io import BytesIO

# Cargar .env
load_dotenv()

# Mostrar credenciales cargadas
print("=" * 60)
print("🔑 CREDENCIALES CARGADAS")
print("=" * 60)
print(f"CLOUDINARY_CLOUD_NAME: {os.getenv('CLOUDINARY_CLOUD_NAME')}")
print(f"CLOUDINARY_API_KEY: {os.getenv('CLOUDINARY_API_KEY')}")
print(f"CLOUDINARY_API_SECRET: {os.getenv('CLOUDINARY_API_SECRET')}")

# Configurar cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

print("\n" + "=" * 60)
print("🧪 PROBANDO UPLOAD A CLOUDINARY")
print("=" * 60)

try:
    # Crear un archivo de prueba en memoria
    test_content = b"Test file from SAK backend"
    test_file = BytesIO(test_content)
    
    # Intentar subir
    result = cloudinary.uploader.upload(
        test_file,
        folder="sak_files/test",
        public_id="credential_test",
        resource_type="raw"
    )
    
    print("\n✅ UPLOAD EXITOSO!")
    print(f"\n📎 URL: {result['secure_url']}")
    print(f"📎 Public ID: {result['public_id']}")
    print(f"📎 Format: {result['format']}")
    print(f"📎 Bytes: {result['bytes']}")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    print(f"\nTipo de error: {type(e).__name__}")
