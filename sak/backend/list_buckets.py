"""
Script simple para listar TODOS los buckets en el proyecto GCP
"""
import os
from dotenv import load_dotenv
from google.cloud import storage

load_dotenv()

PROJECT_ID = os.getenv("GCS_PROJECT_ID")
CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

print(f"Proyecto: {PROJECT_ID}")
print(f"Credenciales: {CREDENTIALS_PATH}\n")

try:
    client = storage.Client.from_service_account_json(
        CREDENTIALS_PATH,
        project=PROJECT_ID
    )
    
    print("=" * 60)
    print("BUCKETS EN EL PROYECTO:")
    print("=" * 60)
    
    buckets = list(client.list_buckets())
    
    if buckets:
        for idx, bucket in enumerate(buckets, 1):
            print(f"{idx}. {bucket.name}")
            print(f"   Ubicación: {bucket.location}")
            print(f"   Storage Class: {bucket.storage_class}")
            print()
    else:
        print("⚠️  NO HAY BUCKETS EN ESTE PROYECTO")
        print("\nEsto significa que necesitas crear el bucket 'sak-facturas-prod'")
    
    print("=" * 60)
    
except Exception as e:
    print(f"❌ ERROR: {str(e)}")
