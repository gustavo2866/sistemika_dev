"""
Test de integración completo para GCS
"""
import os
import sys
from pathlib import Path

# Agregar el directorio backend al path
sys.path.insert(0, str(Path(__file__).parent))

# Cargar variables de entorno
from dotenv import load_dotenv
load_dotenv()

from app.services.gcs_storage_service import storage_service
from datetime import datetime

def test_gcs_integration():
    """Test completo de integración con GCS"""
    
    print("=" * 70)
    print("🧪 TEST DE INTEGRACIÓN COMPLETO - GCS")
    print("=" * 70)
    
    # 1. Verificar configuración
    print("\n📋 1. Verificando configuración...")
    bucket_name = os.getenv("GCS_BUCKET_NAME")
    project_id = os.getenv("GCS_PROJECT_ID")
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    
    print(f"   Bucket: {bucket_name}")
    print(f"   Project: {project_id}")
    print(f"   Credentials: {creds_path}")
    
    if not bucket_name or not project_id or not creds_path:
        print("   ❌ Faltan variables de entorno")
        return False
    
    if not os.path.exists(creds_path):
        print(f"   ❌ Archivo de credenciales no encontrado: {creds_path}")
        return False
    
    print("   ✅ Configuración correcta")
    
    # 2. Verificar cliente GCS
    print("\n🔌 2. Conectando a GCS...")
    try:
        client = storage_service.client
        print(f"   ✅ Cliente creado: {client.project}")
    except Exception as e:
        print(f"   ❌ Error al crear cliente: {e}")
        return False
    
    # 3. Verificar bucket
    print(f"\n📦 3. Verificando bucket '{bucket_name}'...")
    try:
        bucket = storage_service._get_bucket()
        print(f"   ✅ Bucket accesible: {bucket.name}")
    except Exception as e:
        print(f"   ❌ Error al acceder al bucket: {e}")
        return False
    
    # 4. Crear archivo de prueba temporal
    print("\n📄 4. Creando archivo de prueba...")
    temp_dir = Path("uploads/temp")
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    test_filename = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    test_file_path = temp_dir / test_filename
    
    test_content = f"""
Test de integración GCS
Fecha: {datetime.now()}
Bucket: {bucket_name}
Project: {project_id}
"""
    
    with open(test_file_path, "w", encoding="utf-8") as f:
        f.write(test_content)
    
    print(f"   ✅ Archivo creado: {test_file_path}")
    
    # 5. Subir archivo usando upload_invoice
    print("\n📤 5. Subiendo archivo a GCS...")
    try:
        result = storage_service.upload_invoice(
            file_path=str(test_file_path),
            filename=test_filename,
            content_type="text/plain"
        )
        
        print(f"   ✅ Archivo subido exitosamente")
        print(f"   📍 Storage URI: {result['storage_uri']}")
        print(f"   🔗 Download URL: {result['download_url']}")
        print(f"   📦 Bucket: {result['bucket']}")
        print(f"   📝 Blob name: {result['blob_name']}")
        
    except Exception as e:
        print(f"   ❌ Error al subir archivo: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # 6. Verificar que el archivo existe en GCS
    print("\n🔍 6. Verificando archivo en GCS...")
    try:
        blob = bucket.blob(result['blob_name'])
        if blob.exists():
            print(f"   ✅ Archivo existe en GCS")
            print(f"   📊 Tamaño: {blob.size} bytes")
            print(f"   🕐 Creado: {blob.time_created}")
        else:
            print(f"   ❌ Archivo no encontrado en GCS")
            return False
    except Exception as e:
        print(f"   ❌ Error al verificar archivo: {e}")
        return False
    
    # 7. Limpiar - eliminar archivo de prueba
    print("\n🧹 7. Limpiando archivos de prueba...")
    try:
        # Eliminar de GCS
        blob.delete()
        print(f"   ✅ Archivo eliminado de GCS")
        
        # Eliminar local
        test_file_path.unlink()
        print(f"   ✅ Archivo temporal eliminado")
        
    except Exception as e:
        print(f"   ⚠️  Error al limpiar: {e}")
    
    print("\n" + "=" * 70)
    print("🎉 TODOS LOS TESTS PASARON EXITOSAMENTE")
    print("=" * 70)
    print("\n✨ El sistema está listo para:")
    print("   • Subir facturas a GCS")
    print("   • Generar URLs de descarga")
    print("   • Gestionar archivos en el bucket")
    
    return True

if __name__ == "__main__":
    try:
        success = test_gcs_integration()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error fatal: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
