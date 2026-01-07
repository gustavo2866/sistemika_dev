#!/usr/bin/env python3
"""
Script para iniciar el servidor directamente
"""
import uvicorn
from app.main import app

if __name__ == "__main__":
    print("🚀 Iniciando servidor de calculadora financiera...")
    uvicorn.run(
        app, 
        host="127.0.0.1", 
        port=8001, 
        log_level="info"
    )