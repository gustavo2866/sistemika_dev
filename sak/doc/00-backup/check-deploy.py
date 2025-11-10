#!/usr/bin/env python3
"""
Script de verificación pre-deploy para SAK
Verifica que todo esté listo para desplegar en producción
"""

import os
import sys
from pathlib import Path

def check_environment_files():
    """Verificar que existan archivos de configuración"""
    print("🔍 Verificando archivos de configuración...")
    
    checks = {
        "frontend/.env.production": False,
        "frontend/vercel.json": False,
        "frontend/.vercelignore": False,
        "backend/.env.production": False,
        "backend/Procfile": False,
        "backend/railway.json": False,
        "backend/Dockerfile": False,
        "backend/requirements.txt": False,
    }
    
    for file, _ in checks.items():
        if Path(file).exists():
            checks[file] = True
            print(f"  ✅ {file}")
        else:
            print(f"  ❌ {file} - NO ENCONTRADO")
    
    return all(checks.values())

def check_gitignore():
    """Verificar que .gitignore no permita archivos sensibles"""
    print("\n🔍 Verificando .gitignore...")
    
    sensitive_patterns = [
        ".env",
        ".env.local",
        "*.log",
        "__pycache__",
        "node_modules",
    ]
    
    gitignore_files = [".gitignore", "frontend/.gitignore", "backend/.gitignore"]
    
    for gitignore in gitignore_files:
        if Path(gitignore).exists():
            print(f"  ✅ {gitignore} existe")
            with open(gitignore) as f:
                content = f.read()
                for pattern in sensitive_patterns:
                    if pattern in content:
                        print(f"    ✅ Ignora: {pattern}")
                    else:
                        print(f"    ⚠️  No ignora: {pattern}")
        else:
            print(f"  ⚠️  {gitignore} no existe")
    
    return True

def check_env_variables():
    """Verificar variables de entorno necesarias"""
    print("\n🔍 Verificando variables de entorno requeridas...")
    
    # Frontend
    frontend_env = Path("frontend/.env.production")
    if frontend_env.exists():
        print("  ✅ frontend/.env.production existe")
        print("     Recordatorio: Configurar NEXT_PUBLIC_API_URL en Vercel")
    
    # Backend
    backend_env = Path("backend/.env.production")
    if backend_env.exists():
        print("  ✅ backend/.env.production existe")
        print("     Recordatorio: Configurar en Railway/Render:")
        print("       - DATABASE_URL")
        print("       - CORS_ORIGINS")
        print("       - OPENAI_API_KEY (opcional)")
    
    return True

def check_package_json():
    """Verificar package.json del frontend"""
    print("\n🔍 Verificando package.json...")
    
    package_json = Path("frontend/package.json")
    if package_json.exists():
        import json
        with open(package_json) as f:
            data = json.load(f)
            
        if "scripts" in data:
            scripts = data["scripts"]
            if "build" in scripts:
                print(f"  ✅ Script build: {scripts['build']}")
            else:
                print("  ❌ Script 'build' no encontrado")
                return False
                
            if "start" in scripts:
                print(f"  ✅ Script start: {scripts['start']}")
            else:
                print("  ⚠️  Script 'start' no encontrado")
        
        return True
    else:
        print("  ❌ frontend/package.json no encontrado")
        return False

def check_requirements_txt():
    """Verificar requirements.txt del backend"""
    print("\n🔍 Verificando requirements.txt...")
    
    requirements = Path("backend/requirements.txt")
    if requirements.exists():
        with open(requirements) as f:
            content = f.read()
            
        required_packages = ["fastapi", "uvicorn", "sqlalchemy", "psycopg"]
        
        for package in required_packages:
            if package in content.lower():
                print(f"  ✅ {package}")
            else:
                print(f"  ❌ {package} - NO ENCONTRADO")
                return False
        
        return True
    else:
        print("  ❌ backend/requirements.txt no encontrado")
        return False

def check_database_config():
    """Verificar configuración de base de datos"""
    print("\n🔍 Verificando configuración de base de datos...")
    
    db_file = Path("backend/app/db.py")
    if db_file.exists():
        print("  ✅ backend/app/db.py existe")
        print("     Recordatorio: Asegurarse de que usa DATABASE_URL del entorno")
        return True
    else:
        print("  ❌ backend/app/db.py no encontrado")
        return False

def check_cors_config():
    """Verificar configuración de CORS"""
    print("\n🔍 Verificando configuración de CORS...")
    
    main_file = Path("backend/app/main.py")
    if main_file.exists():
        with open(main_file) as f:
            content = f.read()
            
        if "CORS" in content:
            print("  ✅ CORS configurado en main.py")
            if "CORS_ORIGINS" in content:
                print("  ✅ Usa variable CORS_ORIGINS del entorno")
            else:
                print("  ⚠️  No usa variable CORS_ORIGINS (puede ser hardcoded)")
        else:
            print("  ❌ CORS no configurado")
            return False
        
        return True
    else:
        print("  ❌ backend/app/main.py no encontrado")
        return False

def print_deployment_summary():
    """Imprimir resumen de despliegue"""
    print("\n" + "="*60)
    print("📋 RESUMEN DE DESPLIEGUE")
    print("="*60)
    print("""
🎨 FRONTEND (Vercel):
   1. Ir a https://vercel.com/new
   2. Importar repositorio Git
   3. Configurar:
      - Root Directory: frontend
      - Framework: Next.js (auto-detectado)
      - Build Command: npm run build (default)
   4. Variables de entorno:
      - NEXT_PUBLIC_API_URL = https://tu-backend.railway.app

🐍 BACKEND (Railway):
   1. Ir a https://railway.app/new
   2. Deploy from GitHub repo
   3. Configurar:
      - Root Directory: backend
      - Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   4. Variables de entorno:
      - DATABASE_URL = postgresql://... (de Railway PostgreSQL)
      - CORS_ORIGINS = https://tu-app.vercel.app
      - OPENAI_API_KEY = sk-... (opcional)

🗄️ BASE DE DATOS (Railway PostgreSQL):
   1. En Railway: New → PostgreSQL
   2. Copiar la Connection URL
   3. Usarla como DATABASE_URL en el backend
   4. Ejecutar seed: railway run python scripts/seed_sak_backend.py

📚 Más detalles en DEPLOYMENT.md
""")

def main():
    print("="*60)
    print("🚀 SAK - Verificación Pre-Deploy")
    print("="*60)
    
    checks = [
        ("Archivos de configuración", check_environment_files),
        (".gitignore", check_gitignore),
        ("Variables de entorno", check_env_variables),
        ("package.json", check_package_json),
        ("requirements.txt", check_requirements_txt),
        ("Configuración DB", check_database_config),
        ("Configuración CORS", check_cors_config),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Error en {name}: {e}")
            results.append((name, False))
    
    print("\n" + "="*60)
    print("📊 RESULTADOS")
    print("="*60)
    
    for name, result in results:
        status = "✅" if result else "❌"
        print(f"{status} {name}")
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n✅ ¡Todo listo para desplegar!")
        print_deployment_summary()
        return 0
    else:
        print("\n⚠️  Hay problemas que deben resolverse antes de desplegar")
        print("   Revisa los errores arriba y consulta DEPLOYMENT.md")
        return 1

if __name__ == "__main__":
    sys.exit(main())
