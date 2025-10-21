# Backend SAK - Documentación

Sistema de facturación con FastAPI + SQLModel + PostgreSQL + Google Cloud Platform

---

## 🚀 Inicio Rápido

**¿Primera vez aquí?**

1. 📖 [Quickstart - Setup en 5 minutos](setup/quickstart.md)
2. 🏃 [Correr localmente](development/running-locally.md)
3. 📋 [Comandos útiles](reference/commands-cheatsheet.md)

---

## 📚 Documentación Completa

### 🛠️ Setup Inicial

Configuración del entorno de desarrollo:

- [Quickstart](setup/quickstart.md) - Setup completo en 5 minutos
- [Base de datos local (PostgreSQL)](setup/database-local.md) - PostgreSQL en tu máquina
- [Base de datos producción (Neon)](setup/database-neon.md) - Conexión a Neon
- [Variables de entorno](setup/environment-variables.md) - `.env` y configuración
- [Dependencias](setup/dependencies.md) - Python packages y requirements

### 💻 Desarrollo

Workflow de desarrollo diario:

- [Correr el backend](development/running-locally.md) - Uvicorn, hot reload, debugging
- [Testing con Pytest](development/testing.md) - Cómo ejecutar y crear tests
- [Migraciones (Alembic)](development/migrations.md) - Crear y aplicar migraciones
- [Agregar nuevas entidades](development/adding-entities.md) - Guía paso a paso
- [API Endpoints](development/api-endpoints.md) - Lista completa de endpoints

### 🚀 Deployment

Deploy a producción en Google Cloud:

- [GitHub Actions](deployment/github-actions.md) - Workflow automático de deploy
- [Google Cloud Run](deployment/gcp-cloud-run.md) - Configuración de Cloud Run
- [Secrets Management](deployment/secrets-management.md) - GitHub Secrets y GCP Secrets
- [Variables de producción](deployment/environment-prod.md) - ENV vars en Cloud Run
- [Troubleshooting](deployment/troubleshooting.md) - Problemas comunes de deploy

### 🏗️ Arquitectura

Diseño y estructura del proyecto:

- [Tech Stack](architecture/tech-stack.md) - FastAPI + SQLModel + PostgreSQL + GCP
- [Estructura del proyecto](architecture/project-structure.md) - Organización de carpetas
- [Esquema de base de datos](architecture/database-schema.md) - Tablas y relaciones
- [Contrato DataProvider](architecture/dataprovider-contract.md) - API para react-admin
- [Google Cloud Storage](architecture/gcs-storage.md) - Almacenamiento de PDFs (bucket público)

### 🔍 Referencia Rápida

- [Cheatsheet de comandos](reference/commands-cheatsheet.md) - Comandos más usados
- [Troubleshooting común](reference/troubleshooting-common.md) - FAQ y soluciones
- [Recursos externos](reference/external-resources.md) - Links útiles

### 📜 Historia

Documentación histórica (para referencia):

- [Logs de implementación](history/) - Desarrollo histórico
- [Migración desde SQLite](history/migration-from-sqlite.md) - Migración histórica
- [Workflows deprecados](history/deprecated-workflows.md) - sync-master, etc.

---

## 🌐 URLs de Producción

| Servicio | URL |
|----------|-----|
| **Backend API** | https://sak-backend-94464199991.us-central1.run.app |
| **API Docs (Swagger)** | https://sak-backend-94464199991.us-central1.run.app/docs |
| **Frontend** | https://sistemika-sak-frontend.vercel.app |
| **GCS Bucket** | https://storage.googleapis.com/sak-wcl-bucket/ |

---

## 🔧 Tech Stack

- **Framework:** FastAPI 0.115+
- **ORM:** SQLModel (SQLAlchemy 2.0)
- **Base de datos:** PostgreSQL (Neon en producción)
- **Migraciones:** Alembic
- **Cloud:** Google Cloud Platform (Cloud Run + Cloud Storage)
- **CI/CD:** GitHub Actions
- **Testing:** Pytest

---

## 📞 Soporte

- **Documentación antigua:** Ver carpeta `_borrador_old_docs/`
- **Issues:** GitHub Issues del proyecto
- **Logs de producción:** `gcloud run services logs read sak-backend --region us-central1`

---

*Última actualización: Octubre 2025*
