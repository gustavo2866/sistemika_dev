import os
from google.cloud import storage
from dotenv import load_dotenv

load_dotenv()

def test_gcs_connection():
    """Prueba completa de conexión a GCS con configuración de sak-wcl"""
    
    # Leer configuración
    bucket_name = os.getenv("GCS_BUCKET_NAME", "sak-wcl-bucket")
    project_id = os.getenv("GCS_PROJECT_ID", "sak-wcl")
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "./gcp-credentials.json")
    
    print("=" * 70)
    print("🔍 VERIFICACIÓN DE CREDENCIALES GCS - PROYECTO SAK-WCL")
    print("=" * 70)
    print(f"📦 Bucket Name:      {bucket_name}")
    print(f"🏗️  Project ID:       {project_id}")
    print(f"🔑 Credentials Path: {creds_path}")
    print()
    
    # Verificar archivo de credenciales
    if not os.path.exists(creds_path):
        print("❌ ERROR: Archivo de credenciales no encontrado")
        print(f"   Ruta esperada: {os.path.abspath(creds_path)}")
        print("\n📋 Pasos para obtener credenciales:")
        print(f"   1. Ve a: https://console.cloud.google.com/iam-admin/serviceaccounts?project={project_id}")
        print("   2. Crea o selecciona una Service Account")
        print("   3. Genera una clave JSON")
        print(f"   4. Guárdala como: {creds_path}")
        return False
    
    print(f"✅ Archivo de credenciales encontrado ({os.path.getsize(creds_path)} bytes)")
    
    try:
        # Crear cliente
        client = storage.Client.from_service_account_json(
            creds_path, 
            project=project_id
        )
        print("✅ Cliente GCS creado exitosamente")
        
        # Obtener info de la service account
        with open(creds_path, 'r') as f:
            import json
            creds_data = json.load(f)
            print(f"👤 Service Account: {creds_data.get('client_email', 'N/A')}")
        
        # Verificar bucket
        bucket = client.bucket(bucket_name)
        
        if not bucket.exists():
            print(f"❌ ERROR: El bucket '{bucket_name}' no existe")
            print(f"   Créalo en: https://console.cloud.google.com/storage/browser?project={project_id}")
            return False
        
        print(f"✅ Bucket '{bucket_name}' existe y es accesible")
        
        # Información del bucket
        bucket.reload()
        print(f"📍 Ubicación:     {bucket.location}")
        print(f"🔒 Storage Class: {bucket.storage_class}")
        print(f"🕐 Creado:        {bucket.time_created}")
        
        # Probar escritura
        test_blob_name = "test/connection_test.txt"
        blob = bucket.blob(test_blob_name)
        from datetime import datetime
        test_content = f"✅ Test successful\nProject: {project_id}\nBucket: {bucket_name}\nTimestamp: {datetime.now()}"
        
        blob.upload_from_string(test_content, content_type="text/plain")
        print(f"\n✅ Archivo de prueba subido: gs://{bucket_name}/{test_blob_name}")
        
        # Verificar lectura
        downloaded_content = blob.download_as_text()
        if "Test successful" in downloaded_content:
            print("✅ Lectura de archivo verificada")
        
        # Listar contenido actual
        print(f"\n📂 Estructura del bucket '{bucket_name}':")
        
        # Listar carpetas principales
        iterator = client.list_blobs(bucket_name, delimiter="/")
        blobs = list(iterator)
        prefixes = list(iterator.prefixes)
        
        if prefixes:
            print("   Carpetas:")
            for prefix in prefixes:
                count = len(list(client.list_blobs(bucket_name, prefix=prefix, max_results=1000)))
                print(f"   📁 {prefix} ({count} archivos)")
        
        if blobs:
            print(f"\n   Archivos en raíz: {len(blobs)}")
            for blob in blobs[:5]:
                size_kb = blob.size / 1024 if blob.size else 0
                print(f"   📄 {blob.name} ({size_kb:.2f} KB)")
        
        # Limpiar
        blob.delete()
        print(f"\n✅ Archivo de prueba eliminado")
        
        print("\n" + "=" * 70)
        print("🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE")
        print("=" * 70)
        print(f"\n✨ Configuración lista para producción")
        print(f"   Puedes subir facturas a: gs://{bucket_name}/facturas/")
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        print("\n🔧 Posibles soluciones:")
        print("  1. Verifica que la API de Cloud Storage esté habilitada:")
        print(f"     https://console.cloud.google.com/apis/library/storage-api.googleapis.com?project={project_id}")
        print("  2. Verifica permisos de la Service Account:")
        print(f"     https://console.cloud.google.com/iam-admin/iam?project={project_id}")
        print("  3. Verifica que el archivo JSON sea válido y reciente")
        return False

if __name__ == "__main__":
    success = test_gcs_connection()
    exit(0 if success else 1)
