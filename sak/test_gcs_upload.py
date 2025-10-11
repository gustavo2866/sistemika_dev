import os
from google.cloud import storage
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

def test_gcs_upload_direct():
    """Prueba de subida directa sin verificar el bucket primero"""
    
    bucket_name = os.getenv("GCS_BUCKET_NAME", "sak-wcl-bucket")
    project_id = os.getenv("GCS_PROJECT_ID", "sak-wcl")
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "./gcp-credentials.json")
    
    print("=" * 70)
    print("🔍 TEST DIRECTO DE SUBIDA A GCS")
    print("=" * 70)
    print(f"📦 Bucket: {bucket_name}")
    print(f"🏗️  Project: {project_id}")
    print()
    
    try:
        # Crear cliente
        client = storage.Client.from_service_account_json(creds_path, project=project_id)
        print("✅ Cliente GCS creado")
        
        # Intentar subir directamente sin verificar bucket
        bucket = client.bucket(bucket_name)
        blob_name = f"test/upload_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        blob = bucket.blob(blob_name)
        
        test_content = f"✅ Test de subida exitoso\nFecha: {datetime.now()}\nBucket: {bucket_name}"
        
        print(f"📤 Intentando subir archivo: {blob_name}")
        blob.upload_from_string(test_content, content_type="text/plain")
        
        print(f"✅ Archivo subido exitosamente!")
        print(f"   gs://{bucket_name}/{blob_name}")
        
        # Intentar generar URL pública
        try:
            public_url = blob.public_url
            print(f"🔗 URL: {public_url}")
        except:
            print("ℹ️  URL pública no disponible (bucket privado)")
        
        # Verificar lectura
        print(f"\n📥 Verificando lectura del archivo...")
        downloaded = blob.download_as_text()
        if "Test de subida exitoso" in downloaded:
            print("✅ Lectura verificada correctamente")
        
        # Limpiar
        print(f"\n🗑️  Eliminando archivo de prueba...")
        blob.delete()
        print("✅ Archivo eliminado")
        
        print("\n" + "=" * 70)
        print("🎉 ¡ÉXITO! LA CONFIGURACIÓN FUNCIONA CORRECTAMENTE")
        print("=" * 70)
        print(f"\n✨ Puedes subir facturas a: gs://{bucket_name}/facturas/")
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        
        if "403" in str(e):
            print("\n🔧 Problema de permisos. Necesitas agregar estos permisos:")
            print("   1. Ve al bucket en la consola de GCP")
            print(f"      https://console.cloud.google.com/storage/browser/{bucket_name}?project={project_id}")
            print("   2. Tab 'PERMISOS' → 'OTORGAR ACCESO'")
            print("   3. Principal: sak-wcl-service@sak-wcl.iam.gserviceaccount.com")
            print("   4. Rol: 'Administrador de objetos de Storage'")
        
        return False

if __name__ == "__main__":
    success = test_gcs_upload_direct()
    exit(0 if success else 1)
