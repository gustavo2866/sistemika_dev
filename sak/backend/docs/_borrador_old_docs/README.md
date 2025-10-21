Proyecto FastAPI + SQLModel (PostgreSQL)

## Caracteristicas Principales
- API REST con FastAPI y SQLModel
- Base de datos PostgreSQL con migraciones Alembic
- Procesamiento de facturas con extraccion automatica de PDFs
- IA integrada para extraer datos usando OpenAI GPT-3.5-turbo
- Subida de archivos con procesamiento asincrono

## Archivos principales
- app/main.py: arranca FastAPI y registra routers.
- app/db.py: configura la base de datos PostgreSQL y la sesion.
- app/models/base.py: clase generica Base con id, created, updated y utilidades.
- app/crud/generic_crud.py: implementacion generica CRUD reutilizable.
- app/routers/generic_router.py: router generico que puede heredarse o instanciarse.
- app/services/pdf_extraction_service.py: servicio de extraccion de datos de PDFs.

## Configuracion

### 1. Variables de entorno
Copia el archivo .env.example como .env y configura tus valores:

```bash
cp .env.example .env
```

Variables requeridas:
- OPENAI_API_KEY: API key de OpenAI para extraccion de datos de facturas.
- DATABASE_URL: Cadena de conexion PostgreSQL (formato postgresql+psycopg://usuario:contrasena@host:puerto/base).

### 2. Preparacion de PostgreSQL
Sigue la guia `docs/postgres_setup.md` para crear la base de datos, usuario y aplicar los modelos iniciales.

### 3. Instalacion de dependencias

```powershell
python -m pip install -r requirements.txt
```

### 4. Ejecucion en desarrollo

```powershell
uvicorn app.main:app --reload
```

## Funcionalidades de IA

### Extraccion de facturas
- Metodo primario: OCR con pdfplumber.
- Metodo alternativo: OCR con pytesseract + PyMuPDF.
- Procesamiento IA: OpenAI GPT-3.5-turbo con prompts especializados.
- Campos extraidos: numero, proveedor, fechas, importes, detalles e impuestos.

### Configuracion OpenAI
- Modelo: gpt-3.5-turbo.
- Temperatura: 0.1 para respuestas consistentes.
- Max tokens: 2000.
- Fallback: sistema de reglas con expresiones regulares si la IA falla.

Notas:
- El frontend realiza validaciones adicionales; los modelos incluyen utilidades para exponer metadatos id/created/updated y para crear modelos de actualizacion con campos opcionales.
- Los scripts heredados de SQLite se eliminaron tras la migracion; consulta docs/legacy_sqlite_scripts.md si necesitas recuperarlos del historial.
