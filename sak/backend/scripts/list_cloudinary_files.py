#!/usr/bin/env python3
"""
Lista todos los archivos en Cloudinary
"""

import os
from dotenv import load_dotenv
import cloudinary
import cloudinary.api

# Cargar .env
load_dotenv()

# Configurar cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

print("\n" + "=" * 80)
print("📁 ARCHIVOS EN CLOUDINARY")
print("=" * 80)

try:
    # Listar recursos de todos los tipos
    print("\n🖼️  IMÁGENES:")
    images = cloudinary.api.resources(resource_type="image", max_results=100)
    if images['resources']:
        for resource in images['resources']:
            size_kb = resource['bytes'] / 1024
            print(f"   • {resource['public_id']}")
            print(f"     URL: {resource['secure_url']}")
            print(f"     Tamaño: {size_kb:.2f} KB")
            print(f"     Formato: {resource.get('format', 'N/A')}")
            print()
    else:
        print("   (No hay imágenes)")
    
    print("\n📄 ARCHIVOS RAW:")
    raw_files = cloudinary.api.resources(resource_type="raw", max_results=100)
    if raw_files['resources']:
        for resource in raw_files['resources']:
            size_kb = resource['bytes'] / 1024
            print(f"   • {resource['public_id']}")
            print(f"     URL: {resource['secure_url']}")
            print(f"     Tamaño: {size_kb:.2f} KB")
            print(f"     Formato: {resource.get('format', 'N/A')}")
            print()
    else:
        print("   (No hay archivos raw)")
    
    # Resumen
    total_images = len(images['resources'])
    total_raw = len(raw_files['resources'])
    total_files = total_images + total_raw
    
    print("\n" + "=" * 80)
    print(f"📊 RESUMEN: {total_files} archivos totales")
    print(f"   🖼️  Imágenes: {total_images}")
    print(f"   📄 Raw files: {total_raw}")
    print("=" * 80)
    print()
    
except Exception as e:
    print(f"\n❌ Error listando archivos: {e}")
