#!/usr/bin/env bash
# Script de inicio para Render

# Ejecutar migraciones de Alembic si existen
if [ -d "alembic" ]; then
    echo "Ejecutando migraciones de base de datos..."
    alembic upgrade head
fi

# Iniciar el servidor con Uvicorn
uvicorn app.main:app --host 0.0.0.0 --port $PORT
