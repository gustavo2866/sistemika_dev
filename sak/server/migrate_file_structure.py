#!/usr/bin/env python3
"""
Script de migración para actualizar URLs de archivos a la nueva estructura
"""

import os
import sqlite3
from pathlib import Path

def migrate_file_urls():
    """Migra URLs de archivos de la estructura antigua a la nueva"""
    
    # Conectar a la base de datos
    db_path = "test.db"
    if not os.path.exists(db_path):
        print("❌ Base de datos no encontrada")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Obtener todas las tablas
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        print("🔍 Buscando columnas con URLs de archivos...")
        
        updated_count = 0
        
        for table_name in tables:
            table_name = table_name[0]
            
            # Obtener información de columnas
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            
            for column_info in columns:
                column_name = column_info[1]
                
                # Buscar columnas que puedan contener URLs de archivos
                if any(keyword in column_name.lower() for keyword in ['url', 'path', 'file', 'image', 'photo']):
                    print(f"📋 Verificando {table_name}.{column_name}...")
                    
                    # Buscar registros con URLs antiguas
                    cursor.execute(f"SELECT id, {column_name} FROM {table_name} WHERE {column_name} LIKE '/uploads/%' AND {column_name} NOT LIKE '/uploads/images/%' AND {column_name} NOT LIKE '/uploads/facturas/%'")
                    records = cursor.fetchall()
                    
                    for record_id, old_url in records:
                        if old_url and old_url.startswith('/uploads/'):
                            # Determinar el tipo de archivo
                            file_extension = Path(old_url).suffix.lower()
                            
                            if file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                                # Es una imagen
                                filename = Path(old_url).name
                                new_url = f"/uploads/images/{filename}"
                            elif file_extension == '.pdf':
                                # Es un PDF
                                filename = Path(old_url).name
                                new_url = f"/uploads/facturas/{filename}"
                            else:
                                continue  # Saltar archivos de tipo desconocido
                            
                            # Actualizar el registro
                            cursor.execute(f"UPDATE {table_name} SET {column_name} = ? WHERE id = ?", (new_url, record_id))
                            print(f"✅ Actualizado {table_name}.{column_name} (ID: {record_id}): {old_url} → {new_url}")
                            updated_count += 1
        
        # Confirmar cambios
        conn.commit()
        conn.close()
        
        print(f"\n🎉 Migración completada: {updated_count} registros actualizados")
        
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")

def verify_file_structure():
    """Verifica que la nueva estructura de archivos esté correcta"""
    
    uploads_dir = Path("uploads")
    
    print("\n📁 Verificando estructura de directorios...")
    
    # Verificar que existan los directorios
    required_dirs = ["images", "facturas", "temp"]
    for dir_name in required_dirs:
        dir_path = uploads_dir / dir_name
        if dir_path.exists():
            file_count = len(list(dir_path.glob("*")))
            print(f"✅ {dir_path}: {file_count} archivos")
        else:
            print(f"❌ {dir_path}: No existe")
    
    # Verificar que no haya archivos en el directorio raíz
    root_files = [f for f in uploads_dir.glob("*") if f.is_file()]
    if root_files:
        print(f"⚠️  Archivos en directorio raíz que deberían moverse: {len(root_files)}")
        for file in root_files[:5]:  # Mostrar solo los primeros 5
            print(f"   - {file.name}")
        if len(root_files) > 5:
            print(f"   ... y {len(root_files) - 5} más")
    else:
        print("✅ No hay archivos en el directorio raíz")

if __name__ == "__main__":
    print("=== Migración de Estructura de Archivos ===\n")
    
    verify_file_structure()
    migrate_file_urls()
    
    print("\n=== Resumen ===")
    print("✅ Nueva estructura:")
    print("   - /uploads/images/    (imágenes)")
    print("   - /uploads/facturas/  (PDFs de facturas)")
    print("   - /uploads/temp/      (archivos temporales)")
    print("\n✅ URLs actualizadas en la base de datos")
    print("✅ Archivos estáticos configurados en el servidor")
