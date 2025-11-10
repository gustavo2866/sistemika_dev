# 🚀 Getting Started - SAK desde Cero

Guía completa para crear la aplicación SAK desde cero sin conocimiento previo del proyecto.

---

## 📋 Tabla de Contenidos

1. [Prerequisitos](#1-prerequisitos)
2. [Clonar el Repositorio](#2-clonar-el-repositorio)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Setup Backend](#4-setup-backend)
5. [Setup Base de Datos](#5-setup-base-de-datos)
6. [Setup Frontend](#6-setup-frontend)
7. [Verificación Completa](#7-verificación-completa)
8. [Próximos Pasos](#8-próximos-pasos)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisitos

### Software Requerido

Verifica que tengas instalado:

#### Python 3.11+
```bash
python --version
# Debe mostrar: Python 3.11.x o superior
```

Si no está instalado: https://www.python.org/downloads/

#### Node.js 20.x
```bash
node --version
# Debe mostrar: v20.x.x
```

Si no está instalado: https://nodejs.org/ (descargar LTS)

#### npm 10.x+
```bash
npm --version
# Debe mostrar: 10.x.x o superior
```

(Se instala automáticamente con Node.js)

#### PostgreSQL 14+
```bash
psql --version
# Debe mostrar: psql (PostgreSQL) 14.x o superior
```

**Instalación:**
- **Windows:** https://www.postgresql.org/download/windows/
- **Ubuntu/Debian:** `sudo apt install postgresql postgresql-contrib`
- **macOS:** `brew install postgresql@14`

#### Git
```bash
git --version
```

Si no está instalado: https://git-scm.com/downloads

### Herramientas Recomendadas (Opcional)

- **Editor:** Visual Studio Code (https://code.visualstudio.com/)
- **Cliente PostgreSQL:** pgAdmin 4 (https://www.pgadmin.org/) o DBeaver (https://dbeaver.io/)
- **Cliente API:** Thunder Client (extensión VSCode) o Postman

---

## 2. Clonar el Repositorio

### 2.1 Obtener el Código

```bash
# Clonar el repositorio
git clone https://github.com/gustavo2866/sistemika_dev.git

# Entrar al directorio del proyecto SAK
cd sistemika_dev/sak
```

**Nota importante:** SAK es un **monorepo** dentro de `sistemika_dev`. La estructura es:
```
sistemika_dev/          ← Repositorio GitHub
└── sak/                ← Proyecto SAK (aquí trabajarás)
    ├── backend/
    ├── frontend/
    └── doc/
```

### 2.2 Verificar Branch

```bash
# Ver branch actual
git branch
# Debe mostrar: * master

# Si no estás en master:
git checkout master
```

---

## 3. Estructura del Proyecto

Una vez clonado, verás esta estructura en `sak/`:

```
sak/
├── backend/              # 🐍 Backend FastAPI + SQLModel
│   ├── app/             #    Código fuente
│   │   ├── api/         #    Routers y endpoints
│   │   ├── models/      #    Modelos SQLModel
│   │   ├── services/    #    Lógica de negocio
│   │   └── main.py      #    Punto de entrada
│   ├── alembic/         #    Migraciones de base de datos
│   ├── scripts/         #    Seeds y utilidades
│   ├── tests/           #    Tests unitarios
│   ├── requirements.txt #    Dependencias Python
│   ├── .env copy        # ⚠️ TEMPLATE de variables (copiar a .env)
│   └── .env             # ⚠️ CREAR manualmente (gitignored)
│
├── frontend/            # ⚛️ Frontend Next.js 15 + React Admin
│   ├── src/             #    Código fuente
│   │   ├── app/         #    App Router Next.js
│   │   ├── components/  #    Componentes React
│   │   └── lib/         #    Utilidades
│   ├── public/          #    Assets estáticos
│   ├── package.json     #    Dependencias Node.js
│   ├── .env.example     # ⚠️ TEMPLATE de variables (copiar a .env.local)
│   └── .env.local       # ⚠️ CREAR manualmente (gitignored)
│
├── cmd/                 # 📜 Scripts PowerShell de gestión
├── doc/                 # 📚 Documentación
│   ├── setup/           #    ← Estás aquí
│   └── deployment/      #    GitHub Actions, GCP
├── uploads/             # 📁 Storage local (gitignored)
└── gcp-credentials.json # ⚠️ CREAR manualmente si usas GCS (gitignored)
```

---

## 4. Setup Backend

### 4.1 Crear Entorno Virtual

```bash
# Ir al directorio backend
cd backend

# Crear entorno virtual
python -m venv .venv
```

### 4.2 Activar Entorno Virtual

**Windows (PowerShell):**
```powershell
.\.venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```cmd
.venv\Scripts\activate.bat
```

**Linux/macOS:**
```bash
source .venv/bin/activate
```

Deberías ver `(.venv)` al inicio de tu prompt.

### 4.3 Instalar Dependencias

```bash
# Actualizar pip
pip install --upgrade pip

# Instalar todas las dependencias
pip install -r requirements.txt
```

Esto instala:
- FastAPI (framework web)
- SQLModel (ORM)
- Alembic (migraciones)
- psycopg (driver PostgreSQL)
- uvicorn (servidor ASGI)
- pytest (testing)
- google-cloud-storage (GCS)
- Y más...

### 4.4 Crear Archivo de Configuración

El archivo `.env` NO existe en el repositorio (está en `.gitignore`). Debes crearlo desde el template:

```bash
# Copiar template
cp ".env copy" .env

# O en PowerShell:
Copy-Item ".env copy" .env
```

### 4.5 Editar Configuración

Abre `.env` con tu editor y configura las variables:

```env
# ============================================
# 1. ENTORNO
# ============================================
ENV=dev

# ============================================
# 2. BASE DE DATOS
# ============================================
# Para desarrollo local (sigue el paso 5 primero):
DATABASE_URL=postgresql+psycopg://sak_user:TU_PASSWORD_AQUI@localhost:5432/sak

# Logging de queries SQL (1=ver queries, 0=silencioso)
SQLALCHEMY_ECHO=1

# ============================================
# 3. API
# ============================================
CORS_ORIGINS=http://localhost:3000

# ============================================
# 4. SEGURIDAD
# ============================================
# Generar un secret único (ver comandos abajo)
JWT_SECRET=CAMBIAR_POR_SECRET_UNICO

# ============================================
# 5. OPENAI (OPCIONAL - para OCR de facturas)
# ============================================
# Si tienes cuenta OpenAI, pega tu API key aquí
# Si no tienes, déjalo vacío (OCR no funcionará)
OPENAI_API_KEY=

# ============================================
# 6. STORAGE LOCAL
# ============================================
STORAGE_ROOT=./storage

# ============================================
# 7. GOOGLE CLOUD STORAGE (OPCIONAL en local)
# ============================================
# Solo necesario si quieres usar GCS en local
# GCS_PROJECT_ID=sak-wcl
# GCS_BUCKET_NAME=sak-wcl-bucket
# GCS_INVOICE_FOLDER=facturas
# GOOGLE_APPLICATION_CREDENTIALS=./gcp-credentials.json
```

### 4.6 Generar JWT_SECRET

**Python:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**PowerShell:**
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

**OpenSSL:**
```bash
openssl rand -base64 32
```

Copia el resultado y reemplaza `CAMBIAR_POR_SECRET_UNICO` en `.env`.

### 4.7 Obtener OpenAI API Key (Opcional)

Si quieres usar funcionalidades de OCR de facturas:

1. Ir a https://platform.openai.com/api-keys
2. Crear cuenta (si no tienes)
3. Crear nuevo API key
4. Copiar el valor (empieza con `sk-proj-...`)
5. Pegar en `.env` como `OPENAI_API_KEY=sk-proj-...`

**Si no tienes cuenta OpenAI:** Déjalo vacío. La app funcionará pero sin OCR.

---

## 5. Setup Base de Datos

### 5.1 Iniciar PostgreSQL

**Windows:**
```powershell
# Verificar si está corriendo
Get-Service postgresql*

# Si no está corriendo, iniciarlo desde Services
# O usar pgAdmin para iniciar el servidor
```

**Ubuntu/Debian:**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Para que inicie automáticamente
```

**macOS:**
```bash
brew services start postgresql@14
```

### 5.2 Crear Base de Datos y Usuario

```bash
# Conectar como superusuario postgres
psql -U postgres
```

**Ejecutar en psql:**
```sql
-- Crear base de datos
CREATE DATABASE sak;

-- Crear usuario
CREATE USER sak_user WITH PASSWORD 'cambia_esta_clave';

-- Otorgar permisos
GRANT ALL PRIVILEGES ON DATABASE sak TO sak_user;

-- Conectar a la base
\c sak

-- Otorgar permisos en el schema
GRANT ALL ON SCHEMA public TO sak_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sak_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sak_user;

-- Salir
\q
```

### 5.3 Verificar Conexión

```bash
# Probar conexión como sak_user
psql -U sak_user -d sak -h localhost -c "SELECT version();"
```

Si funciona, verás la versión de PostgreSQL.

### 5.4 Actualizar DATABASE_URL

Edita `.env` con la contraseña que elegiste:

```env
DATABASE_URL=postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak
```

### 5.5 Ejecutar Migraciones

Desde `backend/` con el venv activo:

```bash
# Ejecutar migraciones para crear todas las tablas
alembic upgrade head

# Verificar estado
alembic current
```

Deberías ver algo como:
```
INFO  [alembic.runtime.migration] Running upgrade -> abc123, Initial migration
abc123 (head)
```

### 5.6 Cargar Datos de Prueba

```bash
# Ejecutar seed script
python scripts/seed_sak_backend.py
```

Esto crea:
- ✅ Usuario demo: `demo@example.com`
- ✅ 10 artículos de muestra
- ✅ 1 solicitud demo con detalles

**Nota:** Este script es **idempotente**, puedes ejecutarlo varias veces sin problemas.

### 5.7 Verificar Datos

```bash
# Conectar a la base
psql -U sak_user -d sak -h localhost

# Ver tablas creadas
\dt

# Ver usuario demo
SELECT * FROM users WHERE email='demo@example.com';

# Ver artículos
SELECT id, nombre, precio FROM articulos LIMIT 5;

# Salir
\q
```

---

## 6. Setup Frontend

### 6.1 Instalar Dependencias

```bash
# Desde la raíz de sak, ir a frontend
cd ../frontend

# Si ya estás en backend:
cd frontend

# Instalar dependencias
npm install
```

Esto descarga e instala:
- Next.js 15
- React 18
- React Admin
- Shadcn/ui components
- TypeScript
- Y más...

### 6.2 Crear Archivo de Configuración

```bash
# Copiar template
cp .env.example .env.local

# O en Windows:
copy .env.example .env.local
```

### 6.3 Editar Configuración

Abre `.env.local`:

```env
# Backend API URL
# Para desarrollo local:
NEXT_PUBLIC_API_URL=http://localhost:8000

# ⚠️ NO AGREGAR SLASH AL FINAL
```

**Nota:** Esta es la ÚNICA variable necesaria en el frontend. Apunta a la URL de tu backend local.

---

## 7. Verificación Completa

### 7.1 Iniciar Backend

Desde `backend/` con venv activo:

```bash
uvicorn app.main:app --reload
```

Deberías ver:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**URLs importantes:**
- 🏥 Health: http://localhost:8000/health
- 📚 API Docs: http://localhost:8000/docs
- 🔧 API Base: http://localhost:8000/api/v1

### 7.2 Probar Backend

**En otra terminal:**

```bash
# Health check
curl http://localhost:8000/health
# Debe responder: {"status":"healthy"}

# Ver documentación Swagger
# Abrir en navegador: http://localhost:8000/docs
```

### 7.3 Iniciar Frontend

Desde `frontend/`:

```bash
npm run dev
```

Deberías ver:
```
  ▲ Next.js 15.5.4
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Ready in 2.5s
```

### 7.4 Probar Frontend

**Abrir en navegador:**

1. **Homepage:** http://localhost:3000
2. **Panel Admin:** http://localhost:3000/admin

### 7.5 Verificar Integración

1. Ve a http://localhost:3000/admin
2. Navega a "Solicitudes"
3. Deberías ver la solicitud demo creada por el seed
4. Prueba crear una nueva solicitud
5. Verifica que aparezca en la lista

### 7.6 Checklist Final

- ✅ Backend corriendo en http://localhost:8000
- ✅ `/health` responde `{"status":"healthy"}`
- ✅ `/docs` muestra Swagger UI
- ✅ Frontend corriendo en http://localhost:3000
- ✅ Panel admin carga sin errores
- ✅ Lista de solicitudes muestra datos
- ✅ Puedes crear nuevas solicitudes
- ✅ Base de datos tiene datos del seed

---

## 8. Próximos Pasos

### 8.1 Explorar la Aplicación

- Navega por todas las secciones del admin
- Prueba crear, editar y eliminar registros
- Revisa la documentación de la API en `/docs`

### 8.2 Leer Documentación Detallada

- **Backend completo:** `doc/setup/backend.md`
- **Base de datos:** `doc/setup/database.md`
- **Frontend completo:** `doc/setup/frontend.md`
- **Entornos (local/QA/prod):** `doc/setup/environments.md`
- **Inventario de configuraciones:** `doc/setup/CONFIG_INVENTORY.md`

### 8.3 Desarrollo

- Edita código en `backend/app/` (con `--reload` los cambios se aplican automáticamente)
- Edita componentes en `frontend/src/` (Next.js tiene hot reload)
- Crea migraciones: `alembic revision --autogenerate -m "descripción"`
- Ejecuta tests: `pytest -v` (desde `backend/`)

### 8.4 Deploy a Producción

- **Backend:** Ver `doc/deployment/github-actions.md`
- **Frontend:** Ver `doc/setup/frontend.md#deploy-en-vercel`

### 8.5 Herramientas Útiles

**Extensiones VSCode recomendadas:**
- Python (Microsoft)
- Pylance (Microsoft)
- ESLint
- Prettier
- GitLens

**Clientes de base de datos:**
- pgAdmin 4 (GUI para PostgreSQL)
- DBeaver Community

---

## 9. Troubleshooting

### Problemas Comunes

#### `python: command not found`
**Causa:** Python no instalado o no en PATH

**Solución:**
1. Instalar Python desde https://python.org
2. Durante instalación, marcar "Add Python to PATH"
3. Reiniciar terminal

#### `'pip' is not recognized`
**Causa:** pip no en PATH

**Solución:**
```bash
python -m pip --version
# Si funciona, usar siempre: python -m pip install ...
```

#### `node: command not found`
**Causa:** Node.js no instalado

**Solución:** Instalar desde https://nodejs.org/

#### `Cannot connect to database`
**Causa:** PostgreSQL no está corriendo

**Solución:**
- Windows: Verificar servicio en Services
- Linux: `sudo systemctl start postgresql`
- macOS: `brew services start postgresql@14`

#### `ModuleNotFoundError: app`
**Causa:** No estás en `backend/` o venv no activo

**Solución:**
```bash
cd backend
source .venv/bin/activate  # o .\.venv\Scripts\Activate.ps1 en Windows
```

#### `.env` file not found
**Causa:** Archivo `.env` no creado

**Solución:**
```bash
cd backend
cp ".env copy" .env
# Editar .env con tus valores
```

#### `NEXT_PUBLIC_API_URL is undefined`
**Causa:** `.env.local` no existe en frontend

**Solución:**
```bash
cd frontend
cp .env.example .env.local
```

#### Port 8000 already in use
**Causa:** Otro proceso usando el puerto

**Solución:**
```bash
# Linux/macOS
lsof -ti:8000 | xargs kill -9

# Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process

# O cambiar puerto:
uvicorn app.main:app --reload --port 8080
```

#### `alembic: command not found`
**Causa:** venv no activo

**Solución:**
```bash
# Activar venv primero
source .venv/bin/activate  # o Windows: .\.venv\Scripts\Activate.ps1
alembic upgrade head
```

#### CORS errors en el navegador
**Causa:** Frontend URL no está en `CORS_ORIGINS` del backend

**Solución:**
1. Editar `backend/.env`
2. Verificar: `CORS_ORIGINS=http://localhost:3000`
3. Reiniciar backend

#### Frontend no conecta al backend
**Causa:** URL incorrecta en `.env.local`

**Solución:**
1. Verificar `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
2. ⚠️ SIN slash al final
3. Reiniciar `npm run dev`

#### Migraciones fallan
**Causa:** Base de datos no accesible o usuario sin permisos

**Solución:**
1. Verificar que PostgreSQL está corriendo
2. Probar conexión: `psql -U sak_user -d sak -h localhost`
3. Verificar `DATABASE_URL` en `.env`
4. Verificar permisos del usuario (ver paso 5.2)

---

## 🎉 ¡Felicitaciones!

Si llegaste hasta aquí y todo funciona, tienes SAK corriendo localmente.

### Comandos Rápidos para Próximas Veces

**Backend:**
```bash
cd backend
.\.venv\Scripts\Activate.ps1  # Windows
# source .venv/bin/activate    # Linux/macOS
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### Recursos Adicionales

- **Documentación API:** http://localhost:8000/docs
- **GitHub Repo:** https://github.com/gustavo2866/sistemika_dev
- **Documentación completa:** `doc/setup/`

### ¿Necesitas Ayuda?

1. Revisa `doc/setup/GAPS_ANALYSIS.md` para problemas conocidos
2. Consulta documentación específica en `doc/setup/`
3. Revisa logs de backend y frontend

---

*Última actualización: Noviembre 2025*
*Versión: 1.0.0*
