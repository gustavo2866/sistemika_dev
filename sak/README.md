# SAK - Sistema de Administración de Kitchens

Monorepo con frontend Next.js + react-admin y backend FastAPI + SQLModel.

## 📁 Estructura del Proyecto

```
sak/
├── backend/           # Backend FastAPI con SQLModel
│   ├── .venv/        # Entorno virtual Python
│   ├── api/          # Routers y endpoints
│   ├── core/         # Configuración y base de datos
│   ├── models/       # Entidades SQLModel
│   ├── schemas/      # DTOs Pydantic
│   ├── services/     # Lógica de negocio
│   ├── storage/      # Manejo de archivos
│   ├── seed/         # Datos iniciales
│   ├── tests/        # Tests unitarios
│   ├── main.py       # Punto de entrada
│   └── requirements.txt
└── poc1-next/        # Frontend Next.js + react-admin
    ├── node_modules/ # Dependencias Node.js
    ├── app/          # App Router Next.js
    ├── components/   # Componentes React
    └── package.json
```

## 🚀 Desarrollo

### Backend (FastAPI)

```bash
cd backend
.venv\Scripts\Activate.ps1  # Windows
# source .venv/bin/activate  # Linux/Mac
uvicorn main:app --reload
```

**URLs importantes:**
- API: http://127.0.0.1:8000
- Docs: http://127.0.0.1:8000/api/v1/docs  
- Health: http://127.0.0.1:8000/health

### Frontend (Next.js)

```bash
cd poc1-next
npm run dev
```

**URLs importantes:**
- App: http://localhost:3000
- Admin: http://localhost:3000/admin

## 🔧 Configuración

### Variables de Entorno

**Backend (.env):**
```env
DATABASE_URL=sqlite:///./app.db
API_VERSION=v1
STORAGE_ROOT=./storage
CORS_ORIGINS=http://localhost:3000
MAX_UPLOAD_MB=10
ALLOWED_MIME=image/jpeg,image/png,image/gif,image/webp
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_JSON_SERVER_URL=http://127.0.0.1:8000/api/v1
```

## 📊 Datos Iniciales

```bash
cd backend
python seed/initial_data.py
```

Crea:
- 2 marcas: Apple, Samsung
- 2 modelos: iPhone 15, Galaxy S24
- 2 productos con datos completos

## 🧪 Testing

```bash
cd backend
pytest tests/ -v
```

### Reiniciar datos de Parte Diario y tarjas

Desde la raiz del proyecto:

```powershell
python backend/scripts/reset_parte_diario_tarjas.py --dry-run
python backend/scripts/reset_parte_diario_tarjas.py --apply
```

`--dry-run` solo informa cantidades. `--apply` exige escribir `LIMPIAR` y borra
partes diarios, detalles y la estructura de tarjas, conservando nominas,
proyectos, encargados, estados y mensajes CRM. Luego se debe reiniciar el backend
o llamar `POST /api/agente/v3/inbox/reset` para limpiar el contexto en memoria.
El alcance completo esta documentado en
[`backend/agente/v3/subprocesses/parte_diario/README.md`](backend/agente/v3/subprocesses/parte_diario/README.md#limpieza-para-repetir-pruebas).

## 📚 API Endpoints

### CRUD Resources
- `GET/POST /api/v1/brand` - Marcas
- `GET/POST /api/v1/model` - Modelos  
- `GET/POST /api/v1/product` - Productos
- `PUT/DELETE /api/v1/{resource}/{id}` - Update/Delete

### File Upload
- `POST /api/v1/upload` - Subir archivos
- `GET /files/{path}` - Acceder archivos

### Utils
- `GET /health` - Health check
- `GET /` - Info de la API

## 🐳 Docker

```bash
cd backend
docker-compose up --build
```

## 📝 Notas

- El entorno virtual está en `backend/.venv/` (no en la raíz)
- Frontend y backend funcionan independientemente
- CORS configurado para desarrollo local
- Upload de archivos con validación de MIME types y tamaño
- Soft delete implementado en todos los recursos
- Lock optimista con versioning
