#!/usr/bin/env python3
"""
Prueba específica del sistema de login y autenticación
"""

import os
import asyncio
from dotenv import load_dotenv
from sqlmodel import create_engine, Session, text
from passlib.context import CryptContext
import traceback

# Cargar variables de entorno
load_dotenv()

# Configurar el contexto de password hashing (igual que en la app)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def test_login_system():
    """Prueba el sistema completo de login"""
    
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL no encontrada")
        return False
    
    print("🔍 Probando sistema de autenticación...")
    print("=" * 60)
    
    try:
        # Crear engine de SQLAlchemy
        engine = create_engine(database_url)
        
        with Session(engine) as session:
            # 1. Verificar conexión básica
            print("1️⃣ Verificando conexión básica...")
            result = session.exec(text("SELECT 1"))
            if result.first():
                print("   ✅ Conexión OK")
            else:
                print("   ❌ Conexión falló")
                return False
            
            # 2. Verificar que existan las tablas necesarias
            print("\n2️⃣ Verificando tablas de usuario...")
            
            # Verificar tabla usuarios
            result = session.exec(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name IN ('usuarios', 'user', 'users')
            """))
            user_tables = [row[0] for row in result.fetchall()]
            print(f"   📋 Tablas de usuario encontradas: {user_tables}")
            
            if not user_tables:
                print("   ❌ No se encontraron tablas de usuario")
                return False
            
            # Usar la primera tabla encontrada
            user_table = user_tables[0]
            
            # 3. Verificar estructura de la tabla
            print(f"\n3️⃣ Verificando estructura de tabla '{user_table}'...")
            result = session.exec(text(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '{user_table}'
                ORDER BY ordinal_position
            """))
            columns = [(row[0], row[1]) for row in result.fetchall()]
            print("   📊 Columnas encontradas:")
            for col_name, col_type in columns:
                print(f"      - {col_name}: {col_type}")
            
            # 4. Contar usuarios existentes
            print(f"\n4️⃣ Verificando datos en tabla '{user_table}'...")
            result = session.exec(text(f"SELECT COUNT(*) FROM {user_table}"))
            user_count = result.first()[0]
            print(f"   👥 Total de usuarios: {user_count}")
            
            if user_count == 0:
                print("   ⚠️ No hay usuarios en la base de datos")
                return False
            
            # 5. Mostrar algunos usuarios (sin passwords)
            print(f"\n5️⃣ Mostrando primeros usuarios...")
            
            # Intentar diferentes nombres de columna comunes
            email_col = None
            username_col = None
            password_col = None
            
            for col_name, _ in columns:
                if 'email' in col_name.lower():
                    email_col = col_name
                elif 'username' in col_name.lower() or 'usuario' in col_name.lower():
                    username_col = col_name
                elif 'password' in col_name.lower() or 'clave' in col_name.lower():
                    password_col = col_name
            
            # Construir query dinámicamente
            select_cols = []
            if email_col:
                select_cols.append(email_col)
            if username_col:
                select_cols.append(username_col)
            
            if select_cols:
                cols_str = ", ".join(select_cols)
                result = session.exec(text(f"SELECT {cols_str} FROM {user_table} LIMIT 5"))
                users = result.fetchall()
                print(f"   📝 Primeros usuarios:")
                for i, user in enumerate(users):
                    print(f"      {i+1}. {user}")
            
            # 6. Probar autenticación con un usuario específico si existe
            print(f"\n6️⃣ Probando proceso de autenticación...")
            
            if email_col and password_col:
                # Buscar el primer usuario para hacer prueba
                result = session.exec(text(f"SELECT {email_col}, {password_col} FROM {user_table} LIMIT 1"))
                first_user = result.first()
                
                if first_user:
                    email, hashed_password = first_user
                    print(f"   👤 Usuario de prueba: {email}")
                    print(f"   🔐 Hash encontrado: {hashed_password[:30]}...")
                    
                    # Verificar que el hash parece ser bcrypt
                    if hashed_password.startswith('$2b$'):
                        print("   ✅ Hash parece ser bcrypt válido")
                    else:
                        print(f"   ⚠️ Hash no parece ser bcrypt: {hashed_password[:10]}...")
                    
                    return True
                else:
                    print("   ❌ No se pudo obtener usuario para prueba")
                    return False
            else:
                print(f"   ⚠️ No se encontraron columnas estándar (email: {email_col}, password: {password_col})")
                return False
                
    except Exception as e:
        print(f"\n❌ ERROR durante la prueba: {str(e)}")
        print(f"Tipo de error: {type(e).__name__}")
        print("\n📋 Stack trace completo:")
        traceback.print_exc()
        return False

async def test_specific_login(email: str, password: str):
    """Prueba login específico con credenciales"""
    
    database_url = os.getenv('DATABASE_URL')
    engine = create_engine(database_url)
    
    print(f"\n🔐 Probando login específico para: {email}")
    
    try:
        with Session(engine) as session:
            # Intentar encontrar usuario por email
            result = session.exec(text("""
                SELECT email, password_hash, id, nombre 
                FROM usuarios 
                WHERE email = :email
            """), {"email": email})
            
            user = result.first()
            
            if not user:
                print(f"   ❌ Usuario {email} no encontrado")
                return False
            
            email_db, password_hash, user_id, nombre = user
            print(f"   👤 Usuario encontrado: {nombre} (ID: {user_id})")
            
            # Verificar password
            if pwd_context.verify(password, password_hash):
                print("   ✅ Password correcto!")
                return True
            else:
                print("   ❌ Password incorrecto")
                return False
                
    except Exception as e:
        print(f"   ❌ Error en login: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 DIAGNÓSTICO COMPLETO DEL SISTEMA DE AUTENTICACIÓN")
    print("=" * 60)
    
    # Ejecutar prueba general
    success = asyncio.run(test_login_system())
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 SISTEMA DE AUTENTICACIÓN PARECE FUNCIONAL")
        print("✅ Base de datos accesible")
        print("✅ Tablas de usuario existen")
        print("✅ Datos de usuario presentes")
        
        # Opcional: Probar login específico
        print("\n¿Quieres probar un login específico?")
        print("Agrega líneas como estas al final del script:")
        print("# asyncio.run(test_specific_login('usuario@ejemplo.com', 'password123'))")
    else:
        print("💥 PROBLEMAS DETECTADOS EN EL SISTEMA")
        print("Revisa los errores arriba para más detalles")