# Setup Central de SAK

Esta carpeta concentra la informacion de setup extraida y verificada a partir de la documentacion existente en `README.md`, `backend/docs`, `frontend/README.md`, `FRONTEND_READY.md`, `WORKFLOW_INFO.md`, `SETUP_GCP_SECRET.md` y guias relacionadas. El objetivo es tener un unico punto de partida para preparar entornos locales y productivos.

## 🚀 Primera vez? Empieza aquí

**→ [Getting Started - Crear SAK desde Cero](getting-started.md)**

Guía completa paso a paso para instalar y configurar todo desde cero, sin conocimiento previo del proyecto.

## Requisitos base

- Python 3.11 o superior y `pip`
- Node.js 20.x y `npm` 10.x
- PostgreSQL 14 o superior
- Git y acceso al repositorio `sistemika_dev`
- Acceso a los secretos compartidos (Neon, GCP, OpenAI, GitHub, Vercel)

## Flujo rapido

1. **Clonar** el repo y ubicarse en `sak/`.
2. **Configurar backend** siguiendo `backend.md` (venv, deps, `.env`, migraciones, seed).
3. **Preparar base de datos** con `database.md` (PostgreSQL local o Neon).
4. **Configurar frontend** segun `frontend.md` (deps, `.env.local`, scripts `switch-to-*`).
5. **Seleccionar entorno** (local, integracion, produccion) con `environments.md`.
6. **Verificar** salud con `curl http://localhost:8000/health` y `http://localhost:3000`.

## Documentos incluidos

| Archivo | Contenido |
| ------- | --------- |
| `getting-started.md` | **⭐ EMPEZAR AQUÍ** - Guía completa para crear la app desde cero (clonar repo, setup completo, verificación). |
| `backend.md` | Setup completo del backend FastAPI (requisitos, variables, migraciones, GCS, tests). |
| `database.md` | Instalacion y gestion de PostgreSQL local y Neon, migraciones, seed, backups. |
| `frontend.md` | Setup del frontend Next.js/React Admin, variables, scripts de cambio de backend y deploy en Vercel. |
| `environments.md` | Matriz de entornos (local, QA, produccion), URLs, hosting, secretos y checklists. |
| `CONFIG_INVENTORY.md` | **Inventario completo** de todas las configuraciones definidas en esta documentacion (variables, servicios, secrets, comandos). |
| `GAPS_ANALYSIS.md` | Análisis de elementos faltantes en la documentación (uso interno para mejora continua). |

## Verificacion rapida

- Backend local responde en `http://localhost:8000/docs`.
- Frontend local apunta al backend correcto (`NEXT_PUBLIC_API_URL` en consola).
- `alembic current` y `pytest -v` finalizan sin errores.
- Cloud Run y Vercel reciben deploys al hacer push a `master` (ver `WORKFLOW_INFO.md`).

> Referencias cruzadas utilizadas: `backend/docs/setup/quickstart.md`, `backend/docs/setup/database-local.md`, `backend/docs/setup/database-neon.md`, `frontend/SWITCH_BACKEND.md`, `doc/VERCEL_CONFIG.md`, `SETUP_GCP_SECRET.md`, `SECURITY_GCP.md` y `WORKFLOW_INFO.md`.
