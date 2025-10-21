# 🚀 Quickstart - Setup en 5 Minutos

Guía rápida para tener el backend corriendo localmente.

---

## Prerequisitos

- Python 3.11+
- PostgreSQL 14+ (instalado y corriendo)
- Git

---

## Paso 1: Clonar y Entrar al Proyecto

```bash
cd C:\Users\gpalmieri\source\sistemika\sak\backend
```

---

## Paso 2: Crear Entorno Virtual

```powershell
# Crear virtual environment
python -m venv .venv

# Activar (PowerShell)
.\.venv\Scripts\Activate.ps1

# Activar (Bash/Git Bash)
source .venv/Scripts/activate
```

---

## Paso 3: Instalar Dependencias

```bash
pip install -r requirements.txt
```

---

## Paso 4: Configurar Base de Datos

### Opción A: PostgreSQL Local

```sql
-- Conectarse a PostgreSQL
psql -U postgres

-- Crear database y usuario
CREATE DATABASE sak;
CREATE USER sak_user WITH PASSWORD 'cambia_esta_clave';
GRANT ALL PRIVILEGES ON DATABASE sak TO sak_user;
```

### Opción B: Usar Neon (Producción)

Ver [database-neon.md](database-neon.md)

---

## Paso 5: Variables de Entorno

Crear archivo `.env` en `backend/`:

```bash
# Base de datos
DATABASE_URL=postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak

# API
ENV=dev
CORS_ORIGINS=http://localhost:3000
SQLALCHEMY_ECHO=1

# JWT (cambiar en producción)
JWT_SECRET=tu_secret_super_secreto_aqui

# OpenAI (para procesamiento de PDFs)
OPENAI_API_KEY=sk-proj-...

# Google Cloud Storage (opcional en desarrollo)
GCS_PROJECT_ID=sak-wcl
GCS_BUCKET_NAME=sak-wcl-bucket
GCS_INVOICE_FOLDER=facturas
```

---

## Paso 6: Ejecutar Migraciones

```bash
alembic upgrade head
```

Esto creará las tablas y cargará datos iniciales (países, usuarios demo, etc.)

---

## Paso 7: Correr el Backend

```bash
uvicorn app.main:app --reload
```

El servidor estará disponible en: **http://localhost:8000**

---

## ✅ Verificar que Funciona

### 1. Health Check

```bash
curl http://localhost:8000/health
```

Debería responder: `{"status":"healthy"}`

### 2. Documentación API

Abrir en navegador: **http://localhost:8000/docs**

### 3. Ejecutar Tests

```bash
pytest
```

---

## 🎯 Próximos Pasos

- 📖 [Correr localmente con más detalle](../development/running-locally.md)
- 🧪 [Testing](../development/testing.md)
- 🔧 [Variables de entorno completas](environment-variables.md)
- 🗄️ [Setup de base de datos detallado](database-local.md)

---

## 🆘 Problemas Comunes

### Error: "No module named 'app'"

```bash
# Asegurarse de estar en backend/
cd backend
uvicorn app.main:app --reload
```

### Error: "Could not connect to database"

```bash
# Verificar que PostgreSQL esté corriendo
# Windows (Services)
services.msc

# Linux/Mac
sudo systemctl status postgresql
```

### Error: "alembic: command not found"

```bash
# Activar el virtual environment primero
.\.venv\Scripts\Activate.ps1
```

---

*Más ayuda: [Troubleshooting](../reference/troubleshooting-common.md)*
