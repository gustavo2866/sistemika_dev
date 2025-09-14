#!/usr/bin/env python3
"""
Script para diagnosticar e instalar dependencias faltantes
"""

import subprocess
import sys

def install_package(package):
    """Instala un paquete usando pip"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"✓ {package} instalado correctamente")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Error instalando {package}: {e}")
        return False

def check_import(module_name, package_name=None):
    """Verifica si un módulo se puede importar"""
    try:
        __import__(module_name)
        print(f"✓ {module_name} disponible")
        return True
    except ImportError:
        print(f"✗ {module_name} no disponible")
        if package_name:
            print(f"Instalando {package_name}...")
            return install_package(package_name)
        return False

def main():
    print("=== Diagnóstico de Dependencias ===\n")
    
    # Lista de dependencias críticas
    dependencies = [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn[standard]"),
        ("sqlmodel", "sqlmodel"),
        ("aiofiles", "aiofiles"),
        ("pdfplumber", "pdfplumber"),
        ("pytesseract", "pytesseract"),
        ("fitz", "PyMuPDF"),
        ("PIL", "Pillow"),
        ("openai", "openai"),
        ("dotenv", "python-dotenv"),
    ]
    
    all_ok = True
    
    for module, package in dependencies:
        if not check_import(module, package):
            all_ok = False
        print()
    
    if all_ok:
        print("🎉 Todas las dependencias están instaladas correctamente!")
    else:
        print("⚠️ Algunas dependencias faltan o fallaron al instalar")
    
    # Verificar variables de entorno
    print("\n=== Variables de Entorno ===")
    import os
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        print(f"✓ OPENAI_API_KEY configurada: {'*' * (len(openai_key) - 10)}{openai_key[-10:]}")
    else:
        print("✗ OPENAI_API_KEY no configurada")

if __name__ == "__main__":
    main()
