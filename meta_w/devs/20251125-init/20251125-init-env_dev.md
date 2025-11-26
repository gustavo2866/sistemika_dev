# Entorno de Desarrollo - Meta WhatsApp API System

## Pre-requisitos
Este documento detalla las herramientas y dependencias necesarias para configurar el entorno de desarrollo del sistema de recepción y envío de mensajes de WhatsApp mediante la API Cloud de Meta.

**Stack Tecnológico:**
- **Backend**: FastAPI + PostgreSQL + SQLModel
- **Frontend**: Next.js + shadcn/ui (basado en shadcn admin kit)
- **Desarrollo**: ngrok para webhooks locales

---

## Software Requerido

### 1. Base de Datos
- **PostgreSQL** ✓ (Ya instalado en la máquina)
  - Verificar versión: `psql --version`
  - Versión recomendada: PostgreSQL 14 o superior
  - Asegurar que el servicio esté corriendo

### 2. Python
- **Python 3.9 o superior**
  - Descargar desde: https://www.python.org/downloads/
  - Durante la instalación, marcar "Add Python to PATH"
  - Verificar instalación: `python --version`

### 3. FastAPI y Dependencias Python
Instalar las siguientes librerías Python:

```powershell
# Crear entorno virtual (recomendado)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Instalar FastAPI y servidor
pip install fastapi
pip install "uvicorn[standard]"

# Driver PostgreSQL para Python
pip install psycopg2-binary
# O alternativamente
pip install asyncpg

# ORM - SQLModel (combina SQLAlchemy + Pydantic)
pip install sqlmodel

# Migraciones de base de datos
pip install alembic

# Cliente HTTP (para interactuar con API de Meta)
pip install httpx
pip install aiohttp

# Variables de entorno
pip install python-dotenv

# Testing
pip install pytest
pip install pytest-asyncio
pip install httpx  # Para testing de endpoints FastAPI
```

### 4. ngrok
- **ngrok** (para exponer endpoints locales a internet)
  - Descargar desde: https://ngrok.com/download
  - Descomprimir en una carpeta accesible (ej: `C:\ngrok`)
  - Crear cuenta en ngrok.com para obtener authtoken
  - Configurar authtoken: `ngrok config add-authtoken <tu-token>`
  - Verificar instalación: `ngrok version`

### 5. Node.js y npm
- **Node.js 18 LTS o superior** (incluye npm)
  - Descargar desde: https://nodejs.org/
  - Verificar instalación: `node --version` y `npm --version`
  - Recomendado: Node.js 20 LTS

### 6. Frontend - Next.js y Dependencias

```powershell
# Crear proyecto Next.js con TypeScript
npx create-next-app@latest frontend
# Durante la instalación interactiva seleccionar:
# ✓ TypeScript: Yes
# ✓ ESLint: Yes
# ✓ Tailwind CSS: Yes
# ✓ src/ directory: Yes
# ✓ App Router: Yes
# ✓ Turbopack: No (opcional)
# ✓ Import alias: @/* (default)

# Navegar a la carpeta del frontend
cd frontend

# Instalar shadcn/ui CLI
npx shadcn@latest init
# Seleccionar:
# ✓ Style: New York
# ✓ Base color: Slate
# ✓ CSS variables: Yes

# Instalar componentes shadcn necesarios para admin kit
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add table
npx shadcn@latest add data-table
npx shadcn@latest add form
npx shadcn@latest add input
npx shadcn@latest add select
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add avatar
npx shadcn@latest add badge
npx shadcn@latest add toast
npx shadcn@latest add sheet
npx shadcn@latest add separator
npx shadcn@latest add breadcrumb
npx shadcn@latest add tabs

# Dependencias adicionales útiles
npm install axios              # Cliente HTTP
npm install zustand           # State management (ligero)
npm install date-fns          # Manejo de fechas
npm install react-hook-form   # Formularios
npm install zod               # Validación schemas
npm install @tanstack/react-table  # Para data tables avanzadas
npm install lucide-react      # Iconos (usado por shadcn)
```

### 7. Referencia shadcn Admin Kit

**shadcn admin kit** proporciona ejemplos de CRUDs estándar que puedes usar como base:
- Repositorio: https://github.com/salimi-my/shadcn-ui-sidebar
- Demo: https://shadcn-ui-sidebar.vercel.app/

Puedes clonar y adaptar los componentes de ejemplo para:
- Tablas de datos con paginación, filtros y ordenamiento
- Formularios de creación/edición con validación
- Dialogs para confirmaciones
- Layout con sidebar responsive
- Breadcrumbs y navegación

---

## Configuración de Base de Datos

### PostgreSQL Local

1. **Crear base de datos para el proyecto:**
```sql
CREATE DATABASE meta_whatsapp_db;
```

2. **Crear usuario para la aplicación (opcional):**
```sql
CREATE USER meta_user WITH PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE meta_whatsapp_db TO meta_user;
```

3. **Verificar conexión:**
```powershell
psql -U meta_user -d meta_whatsapp_db
```

---

## Herramientas Adicionales (Opcionales pero Recomendadas)

### 1. Git
- Para control de versiones
- Descargar desde: https://git-scm.com/downloads

### 2. Postman o Insomnia
- Para testing de APIs
- Postman: https://www.postman.com/downloads/
- Insomnia: https://insomnia.rest/download

### 3. pgAdmin 4
- Interfaz gráfica para PostgreSQL (si no está instalada)
- Descargar desde: https://www.pgadmin.org/download/

### 4. VS Code Extensions
Si usas Visual Studio Code:
- Python
- Pylance
- PostgreSQL (por Chris Kolkman)
- REST Client
- GitLens
- ES7+ React/Redux/React-Native snippets
- Tailwind CSS IntelliSense
- Prettier - Code formatter
- ESLint

---

## Variables de Entorno

### Backend (.env)
Crear un archivo `.env` en la raíz del proyecto backend con:

```env
# Database
DATABASE_URL=postgresql://meta_user:tu_password_seguro@localhost:5432/meta_whatsapp_db

# FastAPI
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True

# CORS (permitir frontend local)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Meta WhatsApp API
META_API_VERSION=v18.0
META_ACCESS_TOKEN=tu_token_de_meta
META_PHONE_NUMBER_ID=tu_phone_number_id
META_WEBHOOK_VERIFY_TOKEN=tu_token_de_verificacion

# ngrok
NGROK_AUTH_TOKEN=tu_ngrok_token
```

### Frontend (.env.local)
Crear un archivo `.env.local` en la carpeta `frontend/` con:

```env
# API Backend URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Otras configuraciones
NEXT_PUBLIC_APP_NAME=Meta WhatsApp Admin
NEXT_PUBLIC_APP_VERSION=1.0.0
```

**Nota:** En Next.js, las variables que necesitan estar disponibles en el navegador deben tener el prefijo `NEXT_PUBLIC_`

---

## Verificación de Instalación

Ejecutar los siguientes comandos para verificar que todo está instalado correctamente:

```powershell
# Python
python --version

# PostgreSQL
psql --version

# Node.js y npm
node --version
npm --version

# ngrok
ngrok version

# Pip packages
pip list

# Verificar que npm puede instalar paquetes
npm --version
```

---

## Estructura de Proyecto Sugerida

```
meta_w/
├── backend/                 # API FastAPI
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # Punto de entrada FastAPI
│   │   ├── config.py            # Configuración y variables de entorno
│   │   ├── models/              # Modelos SQLModel
│   │   │   ├── __init__.py
│   │   │   ├── empresa.py       # Modelo Empresa
│   │   │   ├── celular.py       # Modelo Celular/Teléfono
│   │   │   ├── mensaje.py       # Modelo Mensaje
│   │   │   └── contacto.py      # Modelo Contacto
│   │   ├── schemas/             # Schemas adicionales (si necesario)
│   │   │   ├── __init__.py
│   │   │   ├── empresa.py
│   │   │   ├── celular.py
│   │   │   ├── mensaje.py
│   │   │   └── webhook.py       # Schemas para webhooks de Meta
│   │   ├── routes/              # Endpoints API
│   │   │   ├── __init__.py
│   │   │   ├── empresas.py      # CRUD empresas
│   │   │   ├── celulares.py     # CRUD celulares
│   │   │   ├── mensajes.py      # Enviar/recibir mensajes
│   │   │   ├── webhook.py       # Webhook de Meta
│   │   │   └── auth.py          # Autenticación (opcional)
│   │   ├── services/            # Lógica de negocio
│   │   │   ├── __init__.py
│   │   │   ├── meta_api.py      # Integración con Meta API
│   │   │   ├── mensaje_service.py
│   │   │   └── webhook_service.py
│   │   └── db/                  # Configuración de BD y sesiones
│   │       ├── __init__.py
│   │       └── session.py       # Gestión de sesiones SQLModel
│   ├── alembic/                 # Migraciones Alembic
│   │   ├── versions/            # Scripts de migración
│   │   │   └── .gitkeep
│   │   ├── env.py               # Configuración Alembic
│   │   ├── README
│   │   └── script.py.mako
│   ├── tests/                   # Tests con pytest
│   │   ├── __init__.py
│   │   ├── conftest.py          # Fixtures pytest
│   │   ├── test_models.py
│   │   ├── test_routes.py
│   │   ├── test_services.py
│   │   └── test_webhook.py
│   ├── alembic.ini              # Configuración Alembic
│   ├── .env                     # Variables de entorno backend
│   ├── .env.example             # Ejemplo de variables de entorno
│   ├── .gitignore
│   ├── requirements.txt         # Dependencias Python
│   ├── requirements-dev.txt     # Dependencias de desarrollo
│   └── README.md
├── frontend/                # Next.js + shadcn/ui
│   ├── public/
│   │   ├── favicon.ico
│   │   └── images/
│   ├── src/
│   │   ├── app/                 # App Router (Next.js 14+)
│   │   │   ├── layout.tsx       # Root layout
│   │   │   ├── page.tsx         # Home/Dashboard page
│   │   │   ├── globals.css      # Estilos globales
│   │   │   ├── providers.tsx    # Context providers
│   │   │   ├── (auth)/          # Grupo de rutas de autenticación
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   └── (dashboard)/     # Grupo de rutas protegidas
│   │   │       ├── layout.tsx   # Layout con sidebar
│   │   │       ├── empresas/
│   │   │       │   ├── page.tsx         # Lista de empresas
│   │   │       │   ├── nueva/
│   │   │       │   │   └── page.tsx     # Crear empresa
│   │   │       │   └── [id]/
│   │   │       │       ├── page.tsx     # Ver/Editar empresa
│   │   │       │       └── editar/
│   │   │       │           └── page.tsx
│   │   │       ├── celulares/
│   │   │       │   ├── page.tsx
│   │   │       │   ├── nuevo/
│   │   │       │   │   └── page.tsx
│   │   │       │   └── [id]/
│   │   │       │       └── page.tsx
│   │   │       └── mensajes/
│   │   │           ├── page.tsx
│   │   │           └── [id]/
│   │   │               └── page.tsx     # Chat view
│   │   ├── components/          # Componentes React
│   │   │   ├── ui/              # Componentes shadcn
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── data-table.tsx
│   │   │   │   ├── form.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── avatar.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   ├── sheet.tsx
│   │   │   │   ├── separator.tsx
│   │   │   │   ├── breadcrumb.tsx
│   │   │   │   └── tabs.tsx
│   │   │   ├── layout/          # Layout components
│   │   │   │   ├── header.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── main-nav.tsx
│   │   │   │   ├── user-nav.tsx
│   │   │   │   └── breadcrumbs.tsx
│   │   │   └── features/        # Feature components (CRUD basado en admin kit)
│   │   │       ├── empresas/
│   │   │       │   ├── empresa-table.tsx      # Data table con paginación
│   │   │       │   ├── empresa-form.tsx       # Formulario create/edit
│   │   │       │   ├── empresa-columns.tsx    # Definición de columnas
│   │   │       │   ├── empresa-actions.tsx    # Acciones de tabla
│   │   │       │   └── empresa-delete-dialog.tsx
│   │   │       ├── celulares/
│   │   │       │   ├── celular-table.tsx
│   │   │       │   ├── celular-form.tsx
│   │   │       │   ├── celular-columns.tsx
│   │   │       │   ├── celular-actions.tsx
│   │   │       │   └── celular-status-badge.tsx
│   │   │       └── mensajes/
│   │   │           ├── mensaje-table.tsx
│   │   │           ├── mensaje-form.tsx
│   │   │           ├── chat-view.tsx
│   │   │           ├── message-bubble.tsx
│   │   │           └── chat-input.tsx
│   │   ├── hooks/               # Custom hooks
│   │   │   ├── use-empresas.ts
│   │   │   ├── use-celulares.ts
│   │   │   ├── use-mensajes.ts
│   │   │   └── use-auth.ts
│   │   ├── lib/                 # Utils y helpers
│   │   │   ├── api.ts           # Configuración axios
│   │   │   ├── utils.ts         # Funciones utils (cn, etc)
│   │   │   ├── constants.ts
│   │   │   └── validators.ts
│   │   ├── services/            # API calls
│   │   │   ├── empresa.service.ts
│   │   │   ├── celular.service.ts
│   │   │   ├── mensaje.service.ts
│   │   │   └── auth.service.ts
│   │   ├── store/               # State management (zustand)
│   │   │   ├── auth-store.ts
│   │   │   ├── empresa-store.ts
│   │   │   └── mensaje-store.ts
│   │   └── types/               # TypeScript types
│   │       ├── empresa.ts
│   │       ├── celular.ts
│   │       ├── mensaje.ts
│   │       └── api.ts
│   ├── .env.local               # Variables de entorno frontend
│   ├── .env.example             # Ejemplo de variables de entorno
│   ├── .gitignore
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── next.config.mjs          # Configuración Next.js
│   ├── tailwind.config.ts       # Configuración Tailwind
│   ├── postcss.config.mjs
│   ├── components.json          # Config de shadcn
│   ├── .eslintrc.json
│   └── README.md
├── devs/                    # Documentación de desarrollo
│   └── 20251125-init/
│       ├── 20251125-init-req.md
│       └── 20251125-init-env_dev.md
├── .gitignore               # Gitignore global
└── README.md                # Documentación principal del proyecto
```

### Descripción de Carpetas Principales

#### Backend (`backend/`)
- **`app/`**: Código principal de la aplicación FastAPI
  - **`models/`**: Modelos de datos con SQLModel (Empresa, Celular, Mensaje, Contacto)
  - **`schemas/`**: Schemas de validación Pydantic para requests/responses
  - **`routes/`**: Definición de endpoints/rutas de la API
  - **`services/`**: Lógica de negocio e integración con servicios externos (Meta API)
  - **`db/`**: Configuración de base de datos y gestión de sesiones
- **`alembic/`**: Sistema de migraciones de base de datos
- **`tests/`**: Tests unitarios y de integración con pytest

#### Frontend (`frontend/`)
- **`src/app/`**: App Router de Next.js (estructura basada en el sistema de archivos)
  - **`(auth)/`**: Grupo de rutas de autenticación (login, registro)
  - **`(dashboard)/`**: Grupo de rutas protegidas con layout compartido (sidebar + header)
  - Cada carpeta representa una ruta y `page.tsx` es la página
- **`src/components/`**: Componentes React reutilizables
  - **`ui/`**: Componentes base de shadcn/ui
  - **`layout/`**: Componentes de estructura (header, sidebar, breadcrumbs)
  - **`features/`**: Componentes CRUD basados en shadcn admin kit (tables, forms, actions)
- **`src/hooks/`**: Custom hooks de React para lógica reutilizable
- **`src/services/`**: Funciones para llamadas a la API backend
- **`src/store/`**: State management global con Zustand
- **`src/lib/`**: Utilidades (api config, utils de shadcn), constantes y validators
- **`src/types/`**: Definiciones de tipos TypeScript

**Patrón CRUD Standard (basado en shadcn admin kit):**
Cada entidad (empresas, celulares, mensajes) tiene:
- `*-table.tsx`: Data table con paginación, filtros y ordenamiento
- `*-columns.tsx`: Definición de columnas con tipos
- `*-form.tsx`: Formulario de creación/edición con validación (react-hook-form + zod)
- `*-actions.tsx`: Dropdown con acciones (ver, editar, eliminar)
- `*-delete-dialog.tsx`: Dialog de confirmación para eliminar

---

## Configuración Inicial de Herramientas

### Alembic (Migraciones de Base de Datos)

1. **Inicializar Alembic en el proyecto:**
```powershell
alembic init alembic
```

2. **Configurar `alembic.ini`:**
   - Comentar la línea `sqlalchemy.url` 
   - La URL se obtendrá desde las variables de entorno

3. **Configurar `alembic/env.py`:**
```python
from app.config import settings
from app.models import *  # Importar todos los modelos
from sqlmodel import SQLModel

# Configurar target_metadata
target_metadata = SQLModel.metadata

# Configurar la URL desde settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
```

4. **Crear primera migración:**
```powershell
alembic revision --autogenerate -m "initial migration"
alembic upgrade head
```

### Pytest (Testing)

1. **Crear archivo `tests/conftest.py`:**
```python
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, SQLModel
from sqlmodel.pool import StaticPool

from app.main import app
from app.db import get_session

@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
```

2. **Ejecutar tests:**
```powershell
# Todos los tests
pytest

# Con coverage
pytest --cov=app tests/

# Tests específicos
pytest tests/test_models.py

# Modo verbose
pytest -v
```

---

## Próximos Pasos

1. Instalar todos los componentes listados (Python, Node.js, PostgreSQL ya instalado, ngrok)
2. Configurar PostgreSQL y crear la base de datos
3. Configurar ngrok con el authtoken
4. **Backend:**
   - Crear estructura de carpetas `backend/`
   - Crear entorno virtual Python y activarlo
   - Instalar dependencias Python (`requirements.txt`)
   - Crear el archivo `.env` con las credenciales necesarias
   - Inicializar el proyecto FastAPI
   - Inicializar Alembic y crear las migraciones iniciales
   - Configurar pytest y crear tests básicos
5. **Frontend:**
   - Crear proyecto Next.js con TypeScript (`npx create-next-app@latest frontend`)
   - Inicializar shadcn/ui (`npx shadcn@latest init`)
   - Instalar componentes shadcn necesarios para admin kit
   - Crear estructura de rutas con App Router
   - Implementar layouts (auth layout, dashboard layout con sidebar)
   - Crear componentes CRUD basados en shadcn admin kit patterns
   - Configurar conexión con API backend (axios en `lib/api.ts`)
6. Configurar webhooks de Meta WhatsApp API
7. Probar integración frontend-backend

---

## Notas Importantes

- **PostgreSQL**: Ya está instalado. Solo necesitas crear la base de datos y configurar el acceso
- **SQLModel**: Combina lo mejor de SQLAlchemy y Pydantic, ideal para FastAPI
- **Alembic**: Maneja las migraciones de base de datos de forma profesional y versionada
- **pytest**: Framework de testing completo con fixtures y plugins para async
- **Next.js**: Framework React con SSR, App Router y optimizaciones automáticas
- **App Router**: Usa el sistema de archivos para definir rutas, layouts y páginas
- **shadcn/ui**: Componentes que se copian a tu proyecto y puedes modificar completamente
- **shadcn admin kit**: Proporciona ejemplos de CRUDs con data tables, forms y acciones estándar
- **Tailwind CSS**: Requerido por shadcn/ui, proporciona utility-first CSS
- **@tanstack/react-table**: Librería potente para data tables con paginación, filtros y ordenamiento
- **CORS**: Asegurar configurar CORS en FastAPI para permitir peticiones desde http://localhost:3000
- **ngrok**: Necesario en desarrollo para que Meta pueda enviar webhooks a tu máquina local
- **Meta API**: Necesitarás crear una aplicación en Meta for Developers y obtener los tokens de acceso
- **Seguridad**: Nunca commitear archivos `.env` o `.env.local` al repositorio (agregarlo a `.gitignore`)
- **Vercel**: Next.js se despliega fácilmente en Vercel (creadores del framework)

---

## Comandos Útiles de Desarrollo

### Backend
```powershell
# Navegar a backend
cd backend

# Activar entorno virtual
.\venv\Scripts\Activate.ps1

# Ejecutar servidor de desarrollo
uvicorn app.main:app --reload --port 8000

# Ejecutar ngrok (en otra terminal)
ngrok http 8000

# Crear nueva migración
alembic revision --autogenerate -m "descripción del cambio"

# Aplicar migraciones
alembic upgrade head

# Revertir última migración
alembic downgrade -1

# Ejecutar tests
pytest -v

# Tests con coverage
pytest --cov=app --cov-report=html tests/
```

### Frontend
```powershell
# Navegar a frontend
cd frontend

# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo (puerto 3000 por defecto)
npm run dev

# Build para producción
npm run build

# Ejecutar build de producción localmente
npm run start

# Linting
npm run lint

# Agregar componente shadcn
npx shadcn@latest add [component-name]

# Type checking
npm run type-check
```

### Ejecución Completa
```powershell
# Terminal 1 - Backend
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend (Next.js en puerto 3000)
cd frontend
npm run dev

# Terminal 3 - ngrok (si necesitas webhooks)
ngrok http 8000
```

**URLs de desarrollo:**
- Backend API: http://localhost:8000
- Backend Docs: http://localhost:8000/docs (Swagger UI)
- Frontend: http://localhost:3000
- ngrok URL: https://xxxxxx.ngrok.io (URL pública temporal)

---

## Soporte

Para más información sobre las tecnologías:

**Backend:**
- FastAPI: https://fastapi.tiangolo.com/
- SQLModel: https://sqlmodel.tiangolo.com/
- Alembic: https://alembic.sqlalchemy.org/
- pytest: https://docs.pytest.org/
- PostgreSQL: https://www.postgresql.org/docs/

**Frontend:**
- Next.js: https://nextjs.org/docs
- React: https://react.dev/
- shadcn/ui: https://ui.shadcn.com/
- shadcn admin examples: https://github.com/salimi-my/shadcn-ui-sidebar
- Tailwind CSS: https://tailwindcss.com/docs
- TanStack Table: https://tanstack.com/table/latest

**Integraciones:**
- Meta WhatsApp API: https://developers.facebook.com/docs/whatsapp/cloud-api
- ngrok: https://ngrok.com/docs
