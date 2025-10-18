"""
Script para verificar y crear el bucket de GCS si no existe
"""
import os
from dotenv import load_dotenv
from google.cloud import storage

# Cargar variables de entorno
load_dotenv()

# Configuración
PROJECT_ID = os.getenv("GCS_PROJECT_ID")
BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")
CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

print("=" * 60)
print("🔍 VERIFICACIÓN DE BUCKET DE GOOGLE CLOUD STORAGE")
print("=" * 60)
print(f"\n📦 Proyecto GCP: {PROJECT_ID}")
print(f"🪣 Bucket solicitado: {BUCKET_NAME}")
print(f"🔑 Credenciales: {CREDENTIALS_PATH}")

# Crear cliente de GCS
if CREDENTIALS_PATH and os.path.exists(CREDENTIALS_PATH):
    print(f"\n✅ Usando credenciales desde: {CREDENTIALS_PATH}")
    client = storage.Client.from_service_account_json(
        CREDENTIALS_PATH,
        project=PROJECT_ID
    )
else:
    print(f"\n⚠️  Usando Application Default Credentials")
    client = storage.Client(project=PROJECT_ID)

print(f"\n🔍 Verificando si el bucket '{BUCKET_NAME}' existe...")

try:
    # Intentar obtener el bucket
    bucket = client.get_bucket(BUCKET_NAME)
    print(f"✅ ¡El bucket '{BUCKET_NAME}' EXISTE!")
    print(f"   📍 Ubicación: {bucket.location}")
    print(f"   🏷️  Storage Class: {bucket.storage_class}")
    print(f"   📅 Creado: {bucket.time_created}")
    
except Exception as e:
    print(f"❌ El bucket '{BUCKET_NAME}' NO EXISTE")
    print(f"   Error: {str(e)}")
    
    # Ofrecer crearlo
    print(f"\n🔧 ¿Deseas crear el bucket? (escribe 'si' para confirmar)")
    respuesta = input("Respuesta: ").strip().lower()
    
    if respuesta in ['si', 'sí', 'yes', 'y', 's']:
        try:
            print(f"\n🚀 Creando bucket '{BUCKET_NAME}'...")
            
            # Crear bucket en la región de South America (São Paulo)
            bucket = client.bucket(BUCKET_NAME)
            bucket.storage_class = "STANDARD"
            new_bucket = client.create_bucket(bucket, location="southamerica-east1")
            
            print(f"✅ ¡Bucket creado exitosamente!")
            print(f"   📍 Ubicación: {new_bucket.location}")
            print(f"   🏷️  Storage Class: {new_bucket.storage_class}")
            
            # Crear carpeta de facturas
            blob = new_bucket.blob("facturas/.keep")
            blob.upload_from_string("")
            print(f"   📁 Carpeta 'facturas/' creada")
            
        except Exception as create_error:
            print(f"❌ Error al crear el bucket: {str(create_error)}")
    else:
        print("\n❌ Operación cancelada")

print("\n" + "=" * 60)
print("🔍 Listando TODOS los buckets en el proyecto:")
print("=" * 60)

try:
    buckets = list(client.list_buckets())
    if buckets:
        for idx, bucket in enumerate(buckets, 1):
            print(f"{idx}. {bucket.name} ({bucket.location})")
    else:
        print("⚠️  No hay buckets en este proyecto")
except Exception as e:
    print(f"❌ Error listando buckets: {str(e)}")

print("\n" + "=" * 60)
