# Meta WhatsApp API - Backend

Backend de la aplicación de gestión de mensajes de WhatsApp con FastAPI.

## Instalación

1. Crear entorno virtual:
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

2. Instalar dependencias:
```powershell
pip install -r requirements.txt
```

3. Configurar variables de entorno:
```powershell
cp .env.example .env
# Editar .env con tus credenciales
```

4. Inicializar Alembic y crear base de datos:
```powershell
alembic init alembic
alembic revision --autogenerate -m "initial migration"
alembic upgrade head
```

5. Crear tablas iniciales y poblar datos de referencia tomados de la documentaci��n de Meta:
```powershell
python -m app.db.init_db
```
Este script crea las entidades del modelo (`empresas`, `celulares`, `contactos`, etc.) y agrega el ejemplo oficial `hello_world` con el phone number ID `891207920743299`, el numero de prueba `+1 (555) 167-6015` y el token utilizado en el cURL de referencia.

Si prefieres ejecutar un seed SQL directamente desde PostgreSQL, usa `app/db/seed_sample_data.sql`:
```powershell
psql -d meta_whatsapp_db -f app/db/seed_sample_data.sql
```

## Ejecutar

```powershell
uvicorn app.main:app --reload --port 8000
```

### Endpoints principales

- `GET /api/v1/empresas` – listado de empresas
- `POST /api/v1/celulares` – registra un phone number verificado
- `GET /api/v1/contactos?empresa_id=...&search=...` – consulta de contactos
- `POST /api/v1/mensajes/send-template` – persiste un envío de plantilla y crea la conversación si no existe
- `POST /api/v1/webhooks/meta/whatsapp?empresa_id=...` – recepción de webhooks de Meta

## Tests

```powershell
pytest -v
```
