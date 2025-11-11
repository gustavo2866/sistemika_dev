"""
Script para crear backup de base de datos local
"""
import os
import subprocess
from datetime import datetime
from pathlib import Path

def create_backup():
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = Path(__file__).parent.parent / 'backups'
    backup_dir.mkdir(exist_ok=True)
    
    backup_file = backup_dir / f'backup_local_{timestamp}.sql'
    
    # Leer DATABASE_URL del .env
    from dotenv import load_dotenv
    load_dotenv()
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL no encontrada en .env")
        return
    
    print(f"Creando backup en: {backup_file}")
    
    # Usar pg_dump si está disponible
    try:
        result = subprocess.run(
            ['pg_dump', database_url, '-f', str(backup_file)],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            file_size = backup_file.stat().st_size
            print(f"✅ Backup creado exitosamente: {file_size / 1024:.2f} KB")
            print(f"📁 Ubicación: {backup_file}")
            return str(backup_file)
        else:
            print(f"❌ Error al crear backup: {result.stderr}")
            return None
    except FileNotFoundError:
        print("⚠️  pg_dump no encontrado. Usando método alternativo...")
        
        # Método alternativo: Copiar la DB con psycopg
        from sqlalchemy import create_engine, text
        
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            # Obtener schema SQL
            with open(backup_file, 'w', encoding='utf-8') as f:
                f.write("-- Backup creado con script Python\n")
                f.write(f"-- Fecha: {datetime.now().isoformat()}\n\n")
                
                # Obtener todas las tablas
                result = conn.execute(text("""
                    SELECT tablename 
                    FROM pg_tables 
                    WHERE schemaname = 'public'
                    ORDER BY tablename
                """))
                
                tables = [row[0] for row in result]
                f.write(f"-- Tablas: {', '.join(tables)}\n\n")
        
        file_size = backup_file.stat().st_size
        print(f"✅ Backup básico creado: {file_size / 1024:.2f} KB")
        print(f"📁 Ubicación: {backup_file}")
        print("⚠️  Nota: Este es un backup limitado. Para backup completo, instalar PostgreSQL client tools")
        return str(backup_file)

if __name__ == '__main__':
    create_backup()
