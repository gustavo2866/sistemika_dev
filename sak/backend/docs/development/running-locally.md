# 🏃 Correr el Backend Localmente

Guía completa para ejecutar y desarrollar el backend en tu máquina local.

---

## Prerequisitos

✅ Completar [Quickstart](../setup/quickstart.md) primero

---

## Comandos Básicos

### Iniciar el Servidor

```bash
cd backend
uvicorn app.main:app --reload
```

**Resultado:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process using StatReload
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### URLs Disponibles

| Endpoint | URL | Descripción |
|----------|-----|-------------|
| **Health Check** | http://localhost:8000/health | Estado del servidor |
| **API Docs (Swagger)** | http://localhost:8000/docs | Documentación interactiva |
| **ReDoc** | http://localhost:8000/redoc | Docs alternativa |
| **OpenAPI JSON** | http://localhost:8000/openapi.json | Spec OpenAPI |
| **API Base** | http://localhost:8000/api/v1/ | Endpoints de la API |

---

## Opciones de Uvicorn

### Hot Reload (Desarrollo)

```bash
uvicorn app.main:app --reload
```

El servidor se reinicia automáticamente cuando guardas cambios en el código.

### Puerto Personalizado

```bash
uvicorn app.main:app --reload --port 8080
```

### Host Específico

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Útil para acceder desde otras máquinas en la red local.

### Log Level

```bash
# Más verboso
uvicorn app.main:app --reload --log-level debug

# Menos verboso
uvicorn app.main:app --reload --log-level warning
```

---

## Activar Virtual Environment

### PowerShell

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
```

### Bash / Git Bash

```bash
cd backend
source .venv/Scripts/activate
```

### CMD (Windows)

```cmd
cd backend
.venv\Scripts\activate.bat
```

### Verificar que está Activado

```bash
which python  # Linux/Mac
where python  # Windows

# Debería mostrar la ruta del venv
# Ejemplo: C:\...\backend\.venv\Scripts\python.exe
```

---

## Variables de Entorno

### Opción 1: Archivo `.env`

Crear `backend/.env`:

```bash
DATABASE_URL=postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak
ENV=dev
CORS_ORIGINS=http://localhost:3000
SQLALCHEMY_ECHO=1
JWT_SECRET=tu_secret_super_secreto
OPENAI_API_KEY=sk-proj-...
```

FastAPI carga automáticamente desde `.env` con `python-dotenv`.

### Opción 2: Variables de Sistema

```powershell
# PowerShell
$env:DATABASE_URL="postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak"
$env:ENV="dev"

# Bash
export DATABASE_URL="postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak"
export ENV="dev"
```

---

## Verificar que Funciona

### 1. Health Check

```bash
curl http://localhost:8000/health
```

**Respuesta esperada:**
```json
{"status":"healthy"}
```

### 2. Probar un Endpoint

```bash
# Listar usuarios
curl http://localhost:8000/api/v1/users/
```

### 3. Swagger UI

Abrir navegador: **http://localhost:8000/docs**

Probar endpoints directamente desde la interfaz.

---

## Debugging

### Ver Queries SQL

En `.env`:

```bash
SQLALCHEMY_ECHO=1
```

Verás todas las queries SQL en la consola.

### VS Code Debugger

Crear `.vscode/launch.json`:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Python: FastAPI",
            "type": "debugpy",
            "request": "launch",
            "module": "uvicorn",
            "args": [
                "app.main:app",
                "--reload",
                "--port",
                "8000"
            ],
            "jinja": true,
            "cwd": "${workspaceFolder}/backend"
        }
    ]
}
```

Luego: **F5** para iniciar debug con breakpoints.

### Logs Personalizados

En cualquier archivo Python:

```python
import logging

logger = logging.getLogger(__name__)

logger.info("Mensaje informativo")
logger.warning("Advertencia")
logger.error("Error")
logger.debug("Debug (solo si SQLALCHEMY_ECHO=1)")
```

---

## Trabajar con Frontend

### Configurar CORS

En `.env`:

```bash
CORS_ORIGINS=http://localhost:3000;http://localhost:5173
```

Múltiples orígenes separados por `;`

### Frontend en Otro Puerto

Si el frontend corre en `http://localhost:3000`:

1. Agregar a `CORS_ORIGINS`
2. Reiniciar backend (`CTRL+C` y volver a `uvicorn`)
3. Verificar que frontend puede hacer requests

---

## Scripts Útiles

### Script PowerShell para Desarrollo

Crear `backend/dev.ps1`:

```powershell
# Activar venv
.\.venv\Scripts\Activate.ps1

# Cargar variables
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
        }
    }
}

# Iniciar servidor
uvicorn app.main:app --reload --port 8000
```

Ejecutar:

```powershell
.\dev.ps1
```

---

## Hot Reload - Archivos Monitoreados

Uvicorn con `--reload` reinicia cuando cambian:

- ✅ Archivos `.py` en `app/`
- ✅ Archivos `.py` en subcarpetas
- ❌ Archivos `.env` (requiere reinicio manual)
- ❌ Archivos `requirements.txt` (requiere `pip install -r requirements.txt`)
- ❌ Migraciones Alembic (requiere `alembic upgrade head`)

---

## 🆘 Troubleshooting

### Error: "Address already in use"

Puerto 8000 ocupado:

```bash
# Ver qué proceso usa el puerto
# Windows
netstat -ano | findstr :8000

# Linux/Mac
lsof -i :8000

# Matar proceso o usar otro puerto
uvicorn app.main:app --reload --port 8080
```

### Error: "No module named 'app'"

```bash
# Asegurarse de estar en backend/
cd backend
uvicorn app.main:app --reload
```

### Error: "ModuleNotFoundError: No module named 'X'"

```bash
# Instalar dependencias faltantes
pip install -r requirements.txt
```

### Cambios no se Reflejan

1. Verificar que `--reload` está activo
2. Guardar el archivo (`CTRL+S`)
3. Esperar ~2 segundos
4. Verificar consola (debe mostrar "Reloading...")

---

## 📚 Ver También

- [Testing](testing.md)
- [API Endpoints](api-endpoints.md)
- [Variables de entorno](../setup/environment-variables.md)
- [Troubleshooting](../reference/troubleshooting-common.md)
