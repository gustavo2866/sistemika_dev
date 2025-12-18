# 📋 Cheatsheet de Comandos

Comandos más usados para desarrollo del backend SAK.

---

## 🚀 Inicio Rápido

```bash
# Activar virtual environment
cd backend
.\.venv\Scripts\Activate.ps1  # PowerShell
source .venv/Scripts/activate  # Bash

# Iniciar servidor
uvicorn app.main:app --reload

# Ejecutar tests
pytest

# Aplicar migraciones
alembic upgrade head
```

---

## 🐍 Virtual Environment

```bash
# Crear venv
python -m venv .venv

# Activar
.\.venv\Scripts\Activate.ps1  # PowerShell
source .venv/Scripts/activate  # Bash/Git Bash
.venv\Scripts\activate.bat     # CMD

# Desactivar
deactivate

# Verificar Python del venv
which python  # Linux/Mac
where python  # Windows
```

---

## 📦 Dependencias

```bash
# Instalar todas
pip install -r requirements.txt

# Instalar una nueva
pip install nombre-paquete

# Agregar a requirements.txt
pip freeze > requirements.txt

# Actualizar un paquete
pip install --upgrade nombre-paquete

# Ver instalados
pip list

# Ver info de un paquete
pip show nombre-paquete
```

---

## 🏃 Servidor Uvicorn

```bash
# Básico con hot reload
uvicorn app.main:app --reload

# Puerto personalizado
uvicorn app.main:app --reload --port 8000

# Host 0.0.0.0 (accesible en red)
uvicorn app.main:app --reload --host 0.0.0.0

# Con más logs
uvicorn app.main:app --reload --log-level debug

# Sin reload (producción)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 🗄️ PostgreSQL

```bash
# Conectarse a PostgreSQL
psql -U postgres
psql -U sak_user -d sak

# Crear database
CREATE DATABASE sak;

# Crear usuario
CREATE USER sak_user WITH PASSWORD 'cambia_esta_clave';

# Dar permisos
GRANT ALL PRIVILEGES ON DATABASE sak TO sak_user;

# Listar databases
\l

# Listar tablas
\dt

# Ver estructura de tabla
\d nombre_tabla

# Salir
\q
```

---

## 🔄 Alembic (Migraciones)

```bash
# Aplicar migraciones
alembic upgrade head

# Ver historial
alembic history

# Ver migración actual
alembic current

# Crear nueva migración
alembic revision -m "descripcion del cambio"

# Crear migración auto (detecta cambios en modelos)
alembic revision --autogenerate -m "descripcion"

# Rollback última migración
alembic downgrade -1

# Ver SQL sin aplicar
alembic upgrade head --sql

# Aplicar a versión específica
alembic upgrade <revision_id>
```

---

## 🧪 Testing

```bash
# Ejecutar todos los tests
pytest

# Con más detalle
pytest -v

# Solo un archivo
pytest tests/test_users.py

# Solo un test específico
pytest tests/test_users.py::test_create_user

# Con coverage
pytest --cov=app

# Coverage con reporte HTML
pytest --cov=app --cov-report=html

# Ver print() en tests
pytest -s

# Parar en primer error
pytest -x
```

---

## 📝 Git

```bash
# Ver estado
git status

# Ver cambios
git diff

# Agregar archivos
git add archivo.py
git add .

# Commit
git commit -m "descripción del cambio"

# Push
git push origin master

# Ver historial
git log --oneline -10

# Ver branches
git branch

# Cambiar branch
git checkout nombre-branch

# Crear y cambiar a nuevo branch
git checkout -b nuevo-branch

# Merge
git merge nombre-branch
```

---

## 🌐 URLs Importantes

```bash
# Backend local
http://localhost:8000

# Health check
http://localhost:8000/health

# Swagger UI (docs interactiva)
http://localhost:8000/docs

# ReDoc (docs alternativa)
http://localhost:8000/redoc

# OpenAPI spec
http://localhost:8000/openapi.json

# Endpoints API
http://localhost:8000/api/v1/users/
http://localhost:8000/api/v1/clientes/
http://localhost:8000/api/v1/facturas/
```

---

## ☁️ Google Cloud (GCP)

```bash
# Ver logs de Cloud Run
gcloud run services logs read sak-backend --region us-central1 --limit 50

# Describir servicio
gcloud run services describe sak-backend --region us-central1

# Listar services
gcloud run services list

# Deploy manual
gcloud run deploy sak-backend --source ./backend --region us-central1

# Ver variables de entorno
gcloud run services describe sak-backend --region us-central1 --format="value(spec.template.spec.containers[0].env)"

# Ver secrets
gcloud secrets list

# Crear secret
gcloud secrets create NOMBRE_SECRET --data-file=archivo.txt
```

---

## 🔍 Debugging

```bash
# Ver procesos en puerto
netstat -ano | findstr :8000  # Windows
lsof -i :8000                  # Linux/Mac

# Matar proceso por PID
taskkill /PID <pid> /F  # Windows
kill -9 <pid>            # Linux/Mac

# Ver variables de entorno
$env:DATABASE_URL  # PowerShell
echo $DATABASE_URL # Bash

# Probar endpoint con curl
curl http://localhost:8000/health
curl -X GET http://localhost:8000/api/v1/users/

# Con headers
curl -H "Authorization: Bearer token" http://localhost:8000/api/v1/users/
```

---

## 📊 Base de Datos Útiles

```bash
# Backup database
pg_dump -U sak_user sak > backup.sql

# Restore database
psql -U sak_user sak < backup.sql

# Resetear database (⚠️ CUIDADO)
psql -U postgres -c "DROP DATABASE sak;"
psql -U postgres -c "CREATE DATABASE sak;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE sak TO sak_user;"
alembic upgrade head

# Ver tamaño de database
psql -U sak_user -d sak -c "SELECT pg_size_pretty(pg_database_size('sak'));"

# Ver tablas con más filas
psql -U sak_user -d sak -c "SELECT schemaname,relname,n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"
```

---

## 🚀 Deploy

```bash
# Hacer push a master (activa GitHub Actions)
git push origin master

# Ver estado de workflows
# → Ir a: https://github.com/gustavo2866/sistemika_dev/actions

# Verificar deployment
curl https://sak-backend-94464199991.us-central1.run.app/health
```

---

## 🔗 Links Rápidos

| Recurso | URL |
|---------|-----|
| **Backend Producción** | https://sak-backend-94464199991.us-central1.run.app |
| **API Docs Producción** | https://sak-backend-94464199991.us-central1.run.app/docs |
| **Frontend Producción** | https://sistemika-sak-frontend.vercel.app |
| **GitHub Actions** | https://github.com/gustavo2866/sistemika_dev/actions |
| **Neon Console** | https://console.neon.tech |
| **GCP Console** | https://console.cloud.google.com |

---

*Para más detalles ver [Documentación completa](../README.md)*
