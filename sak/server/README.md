Proyecto FastAPI + SQLModel (SQLite)

## Características Principales
- **API REST** con FastAPI y SQLModel
- **Base de datos** SQLite con migraciones Alembic
- **Procesamiento de facturas** con extracción automática de PDFs
- **IA integrada** para extraer datos usando OpenAI GPT-3.5-turbo
- **Subida de archivos** con procesamiento asíncrono

## Archivos principales:
- `app/main.py`: arranca FastAPI y registra routers.
- `app/db.py`: configura la base de datos SQLite y la sesión.
- `app/models/base.py`: clase genérica `Base` con `id`, `created`, `updated` y utilidades.
- `app/crud/generic_crud.py`: implementación genérica CRUD reutilizable.
- `app/routers/generic_router.py`: router genérico que puede heredarse/instanciarse.
- `app/services/pdf_extraction_service.py`: servicio de extracción de datos de PDFs

## Configuración

### 1. Variables de Entorno
Copia el archivo `.env.example` como `.env` y configura:

```bash
cp .env.example .env
```

**Variables requeridas:**
- `OPENAI_API_KEY`: Tu API key de OpenAI para extracción de datos de facturas

### 2. Instalación

```powershell
python -m pip install -r requirements.txt
```

### 3. Desarrollo

```powershell
# Para desarrollo con recarga automática
uvicorn app.main:app --reload
```

## Funcionalidades de IA

### Extracción de Facturas
- **Método primario:** OCR con pdfplumber
- **Método fallback:** OCR con pytesseract + PyMuPDF
- **Procesamiento IA:** OpenAI GPT-3.5-turbo con prompts especializados
- **Campos extraídos:** Número, proveedor, fechas, importes, detalles, impuestos

### Configuración OpenAI
- **Modelo:** gpt-3.5-turbo
- **Temperatura:** 0.1 (respuestas consistentes)
- **Max tokens:** 2000
- **Fallback:** Sistema de reglas con regex si falla la IA

Notas:
- Validaciones esperadas en el frontend; los modelos incluyen utilidades para extraer metadatos `id/created/updated` y para crear un modelo de update con campos opcionales.
