"""
Test de conexión a Neon PostgreSQL
"""
from sqlalchemy import text
from app.db import engine, DATABASE_URL, get_session

print("="*60)
print("🧪 TEST DE CONEXIÓN A NEON PostgreSQL")
print("="*60)
print(f"🔗 URL: {DATABASE_URL}")
print()

# Test 1: Conexión básica
print("1️⃣ Test de conexión básica...")
try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT current_database(), current_user, version();"))
        db, user, version = result.fetchone()
        print(f"   ✅ Base de datos: {db}")
        print(f"   ✅ Usuario: {user}")
        print(f"   ✅ Versión: {version[:50]}...")
except Exception as e:
    print(f"   ❌ Error: {e}")
    exit(1)

# Test 2: Ver tablas existentes
print("\n2️⃣ Tablas en la base de datos...")
try:
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """))
        tables = result.fetchall()
        if tables:
            print(f"   📊 Total de tablas: {len(tables)}")
            for table in tables:
                print(f"   📋 {table[0]}")
        else:
            print("   ⚠️  No hay tablas aún")
            print("   💡 Ejecuta: alembic upgrade head")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 3: Verificar schema de alembic
print("\n3️⃣ Estado de migraciones (Alembic)...")
try:
    with engine.connect() as conn:
        # Ver si existe la tabla alembic_version
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'alembic_version'
            );
        """))
        exists = result.fetchone()[0]
        
        if exists:
            result = conn.execute(text("SELECT version_num FROM alembic_version;"))
            version = result.fetchone()
            if version:
                print(f"   ✅ Versión actual: {version[0]}")
            else:
                print("   ⚠️  Tabla alembic_version existe pero está vacía")
        else:
            print("   ⚠️  No hay migraciones aplicadas aún")
            print("   💡 Ejecuta: alembic upgrade head")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 4: Test de escritura/lectura
print("\n4️⃣ Test de permisos de escritura...")
try:
    with engine.connect() as conn:
        # Crear tabla temporal
        conn.execute(text("CREATE TEMP TABLE test_write (id INT, name TEXT);"))
        conn.execute(text("INSERT INTO test_write VALUES (1, 'test');"))
        result = conn.execute(text("SELECT * FROM test_write;"))
        row = result.fetchone()
        conn.commit()
        print(f"   ✅ Permisos de lectura/escritura OK")
        print(f"   ✅ Test data: {row}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "="*60)
print("✅ TESTS COMPLETADOS")
print("="*60)
print("\n📝 Próximos pasos:")
print("   1. Si no hay tablas: alembic upgrade head")
print("   2. Ejecutar backend: uvicorn app.main:app --reload")
print("   3. Probar endpoints desde el frontend")
