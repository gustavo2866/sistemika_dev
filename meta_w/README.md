# Meta WhatsApp API System

Sistema multi-empresa para recepción y envío de mensajes de WhatsApp a través de la integración con las API Cloud de Meta.

## Stack Tecnológico

### Backend
- **FastAPI** - Framework web Python
- **PostgreSQL** - Base de datos
- **SQLModel** - ORM (SQLAlchemy + Pydantic)
- **Alembic** - Migraciones de base de datos
- **pytest** - Testing

### Frontend
- **Next.js 15** - Framework React con App Router
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos
- **shadcn/ui** - Componentes UI (basado en admin kit)
- **Zustand** - State management
- **TanStack Table** - Data tables avanzadas

## Estructura del Proyecto

```
meta_w/
├── backend/          # API FastAPI
│   ├── app/          # Código de la aplicación
│   ├── tests/        # Tests con pytest
│   ├── venv/         # Entorno virtual Python
│   └── requirements.txt
├── frontend/         # Aplicación Next.js
│   ├── src/          # Código fuente
│   └── package.json
└── devs/             # Documentación de desarrollo
```

## Requisitos Previos

- Python 3.9 o superior ✓ (Instalado: 3.12.3)
- Node.js 18 o superior ✓ (Instalado: 22.19.0)
- PostgreSQL ✓ (Instalado: v17)
- ngrok (para desarrollo con webhooks)

## Instalación

### 1. Backend

```powershell
# Navegar al backend
cd backend

# Activar entorno virtual
.\venv\Scripts\Activate.ps1

# Las dependencias ya están instaladas
# Si necesitas reinstalarlas: pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Crear base de datos PostgreSQL
# (Ver sección de Base de Datos abajo)

# Inicializar Alembic (cuando estés listo para crear modelos)
alembic init alembic
```

### 2. Frontend

```powershell
# Navegar al frontend
cd frontend

# Las dependencias ya están instaladas
# Si necesitas reinstalarlas: npm install

# Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con la URL del backend
```

## Base de Datos PostgreSQL

Crear la base de datos y usuario (ejecutar en PostgreSQL):

```sql
-- Conectarse a PostgreSQL como administrador
-- Ejemplo: psql -U postgres

CREATE DATABASE meta_whatsapp_db;
CREATE USER meta_user WITH PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE meta_whatsapp_db TO meta_user;
```

Actualizar `.env` en el backend con la cadena de conexión:
```
DATABASE_URL=postgresql://meta_user:tu_password_seguro@localhost:5432/meta_whatsapp_db
```

## Ejecución en Desarrollo

### Terminal 1 - Backend
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

**URL:** http://localhost:8000  
**Docs:** http://localhost:8000/docs (Swagger UI)

### Terminal 2 - Frontend
```powershell
cd frontend
npm run dev
```

**URL:** http://localhost:3000

### Terminal 3 - ngrok (opcional, para webhooks)
```powershell
ngrok http 8000
```

## Estado de la Instalación

### ✅ Completado

- [x] Python 3.12.3 verificado
- [x] Node.js 22.19.0 verificado
- [x] PostgreSQL 17 verificado y corriendo
- [x] Estructura de carpetas backend creada
- [x] Entorno virtual Python creado y activado
- [x] Dependencias Python instaladas (FastAPI, SQLModel, Alembic, pytest, etc.)
- [x] Archivos de configuración backend (.env.example, .gitignore, README)
- [x] Proyecto Next.js creado con TypeScript y Tailwind
- [x] shadcn/ui inicializado
- [x] Componentes shadcn instalados (button, card, table, form, dialog, etc.)
- [x] Dependencias frontend instaladas (axios, zustand, react-hook-form, zod, @tanstack/react-table)
- [x] Archivos de configuración frontend (.env.local.example, README)

### ⏳ Pendiente

- [ ] Instalar ngrok (si se necesitan webhooks en desarrollo)
- [ ] Crear base de datos meta_whatsapp_db en PostgreSQL
- [ ] Configurar archivo .env en backend con credenciales reales
- [ ] Configurar archivo .env.local en frontend
- [ ] Crear modelos de base de datos (Empresa, Celular, Mensaje, Contacto)
- [ ] Inicializar Alembic y crear migraciones
- [ ] Configurar credenciales de Meta WhatsApp API
- [ ] Implementar endpoints de la API
- [ ] Implementar componentes y páginas del frontend

## Próximos Pasos

1. **Configurar Base de Datos**
   - Crear la base de datos meta_whatsapp_db
   - Configurar .env con la cadena de conexión

2. **Definir Modelos**
   - Crear modelos SQLModel (Empresa, Celular, Mensaje, Contacto)
   - Inicializar Alembic
   - Crear y aplicar migraciones

3. **Implementar Backend**
   - Crear endpoints FastAPI
   - Implementar lógica de negocio
   - Integrar con Meta WhatsApp API
   - Configurar webhooks

4. **Implementar Frontend**
   - Crear layouts (auth, dashboard con sidebar)
   - Implementar CRUDs basados en shadcn admin kit
   - Conectar con API backend
   - Implementar vista de chat para mensajes

5. **Testing y Deploy**
   - Escribir tests con pytest
   - Configurar deploy en GCP Cloud Run (backend)
   - Configurar deploy en Vercel (frontend)

## Documentación

- [Requerimientos](devs/20251125-init/20251125-init-req.md)
- [Entorno de Desarrollo](devs/20251125-init/20251125-init-env_dev.md)
- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)

## Recursos

- **FastAPI:** https://fastapi.tiangolo.com/
- **SQLModel:** https://sqlmodel.tiangolo.com/
- **Next.js:** https://nextjs.org/docs
- **shadcn/ui:** https://ui.shadcn.com/
- **shadcn admin kit:** https://github.com/salimi-my/shadcn-ui-sidebar
- **Meta WhatsApp API:** https://developers.facebook.com/docs/whatsapp/cloud-api
