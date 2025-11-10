# Análisis de Gaps en Documentación de Setup

## 🎯 Objetivo
Evaluar si con la documentación actual en `doc/setup/` se puede **crear la aplicación desde cero** sin conocimiento previo.

---

## ✅ Lo que SÍ está documentado

### 1. Backend Setup
- ✅ Requisitos (Python 3.11+, pip, virtualenv)
- ✅ Instalación de dependencias (`requirements.txt`)
- ✅ Variables de entorno (15 variables documentadas)
- ✅ Migraciones Alembic
- ✅ Seed data
- ✅ Comando para iniciar servidor
- ✅ Testing con pytest

### 2. Base de Datos
- ✅ Instalación PostgreSQL (Windows/Ubuntu/macOS)
- ✅ Creación de base y usuario
- ✅ Configuración de permisos
- ✅ Neon (URLs pooled y directas)
- ✅ Backups y restore
- ✅ Verificación de integridad

### 3. Frontend Setup
- ✅ Requisitos (Node.js 20.x, npm 10.x)
- ✅ Instalación de dependencias
- ✅ Variables de entorno
- ✅ Scripts de cambio de backend
- ✅ Deploy en Vercel

### 4. Entornos
- ✅ Matriz completa (local/QA/producción)
- ✅ URLs de servicios
- ✅ Configuración de secrets
- ✅ Checklists de verificación

---

## ❌ GAPS CRÍTICOS - Lo que FALTA para crear desde cero

### 🔴 GAP 1: Obtención del Código Fuente

**Estado:** ❌ NO DOCUMENTADO

**Problema:**
- No hay instrucciones de cómo clonar el repositorio
- No se indica la URL del repo de GitHub
- No se menciona el branch correcto (`master`)
- No se explica la estructura de monorepo (`sistemika/sak/`)

**Necesario:**
```bash
# Clonar repositorio
git clone https://github.com/gustavo2866/sistemika_dev.git
cd sistemika_dev/sak

# Verificar branch
git branch
git checkout master
```

**Impacto:** 🔴 CRÍTICO - Sin esto, no se puede empezar

---

### 🔴 GAP 2: Estructura Inicial del Proyecto

**Estado:** ❌ PARCIALMENTE DOCUMENTADO

**Problema:**
- `README.md` root tiene estructura pero es genérica/vieja
- No menciona todas las carpetas actuales (`cmd/`, `doc/`, `uploads/`)
- No explica qué hacer con `gcp-credentials.json` (debe crearse)
- No menciona `.env copy` vs `.env`

**Necesario:**
```
sak/
├── backend/              # Backend FastAPI
│   ├── app/             # Código fuente
│   ├── alembic/         # Migraciones
│   ├── scripts/         # Seeds y utilidades
│   ├── tests/           # Tests unitarios
│   ├── requirements.txt # Dependencias Python
│   ├── .env copy        # ⚠️ Template de variables
│   └── .env             # ⚠️ CREAR manualmente (gitignored)
├── frontend/            # Frontend Next.js
│   ├── src/             # Código fuente
│   ├── public/          # Assets estáticos
│   ├── .env.example     # Template de variables
│   └── .env.local       # ⚠️ CREAR manualmente (gitignored)
├── cmd/                 # Scripts PowerShell de gestión
├── doc/                 # Documentación
│   ├── setup/          # ← Documentación actual
│   └── deployment/     # GitHub Actions, validación
├── uploads/             # Storage local (gitignored)
└── gcp-credentials.json # ⚠️ CREAR manualmente (gitignored)
```

**Impacto:** 🟡 MEDIO - Causa confusión inicial

---

### 🔴 GAP 3: Creación de Archivos de Configuración

**Estado:** ❌ NO DOCUMENTADO

**Problema:**
- No se explica que `.env` y `.env.local` NO existen inicialmente
- No hay instrucciones para copiar templates
- No se documenta que `gcp-credentials.json` debe descargarse de GCP

**Necesario:**

#### Backend `.env`:
```bash
cd backend
cp ".env copy" .env
# Editar .env con valores reales
```

**Valores a completar:**
- `DATABASE_URL` → ¿Neon o local?
- `JWT_SECRET` → ¿Cómo generarlo?
- `OPENAI_API_KEY` → ¿Dónde obtenerlo?
- `gcp-credentials.json` → ¿Cómo descargarlo?

#### Frontend `.env.local`:
```bash
cd frontend
cp .env.example .env.local
# Editar NEXT_PUBLIC_API_URL
```

**Impacto:** 🔴 CRÍTICO - Sin esto, la app no arranca

---

### 🔴 GAP 4: Orden de Ejecución (Step-by-Step)

**Estado:** ❌ NO DOCUMENTADO SECUENCIALMENTE

**Problema:**
- La documentación actual está **organizada por tema**, no por **orden de ejecución**
- No hay una guía "Getting Started" que diga: "Haz esto primero, luego esto, luego esto"
- Un nuevo desarrollador no sabe por dónde empezar

**Necesario:**
```
ORDEN CORRECTO PARA SETUP DESDE CERO:

1. Clonar repositorio
2. Instalar prerequisitos (Python, Node.js, PostgreSQL)
3. Crear archivos de configuración (.env, .env.local, gcp-credentials.json)
4. Setup backend:
   - Crear venv
   - Instalar dependencias
   - Configurar base de datos
   - Ejecutar migraciones
   - Ejecutar seed
5. Verificar backend (curl /health)
6. Setup frontend:
   - Instalar dependencias
   - Configurar .env.local
7. Verificar frontend (http://localhost:3000)
8. Probar integración completa
```

**Impacto:** 🔴 CRÍTICO - Causa errores y frustración

---

### 🟡 GAP 5: Generación de Secrets

**Estado:** ❌ NO DOCUMENTADO

**Problema:**
- Se menciona `JWT_SECRET=<genera_un_secret_unico>` pero no SE EXPLICA CÓMO
- No hay comando sugerido para generar valores seguros
- OpenAI API Key: ¿cómo obtenerlo? ¿es opcional?

**Necesario:**

#### Generar JWT_SECRET:
```bash
# Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# OpenSSL
openssl rand -base64 32
```

#### OpenAI API Key:
```
1. Ir a https://platform.openai.com/api-keys
2. Crear nuevo API key
3. Copiar el valor (empieza con sk-proj-...)
4. Agregar a .env como OPENAI_API_KEY=sk-proj-...

⚠️ OPCIONAL: Si no tienes cuenta OpenAI, puedes dejar vacío.
   Funcionalidades de OCR de facturas no estarán disponibles.
```

**Impacto:** 🟡 MEDIO - Bloquea funcionalidad de OCR

---

### 🟡 GAP 6: GCP Credentials Setup

**Estado:** ✅ DOCUMENTADO EN `SETUP_GCP_SECRET.md` pero ❌ NO REFERENCIADO en doc/setup/

**Problema:**
- `backend.md` menciona `gcp-credentials.json` pero no dice cómo obtenerlo
- No está linkeado desde `doc/setup/`
- La documentación existe pero en otro lugar

**Necesario:**
1. Crear link en `backend.md` → `../../SETUP_GCP_SECRET.md`
2. O mover `SETUP_GCP_SECRET.md` a `doc/setup/gcp-credentials.md`
3. O incluir resumen en `backend.md`:

```markdown
### Obtener gcp-credentials.json

1. Ir a GCP Console → IAM & Admin → Service Accounts
2. Seleccionar `sak-wcl-service@sak-wcl.iam.gserviceaccount.com`
3. Keys → Add Key → Create new key → JSON
4. Descargar archivo
5. Renombrar a `gcp-credentials.json`
6. Mover a `backend/gcp-credentials.json`
7. ⚠️ NUNCA comitear este archivo (está en .gitignore)

📖 Guía completa: Ver `SETUP_GCP_SECRET.md`
```

**Impacto:** 🟡 MEDIO - Bloquea uso de GCS en local

---

### 🟡 GAP 7: Verificación de Instalación de Requisitos

**Estado:** ❌ NO DOCUMENTADO

**Problema:**
- Se listan requisitos pero no cómo verificar que están instalados
- No hay comandos para validar versiones

**Necesario:**

```bash
# Verificar Python
python --version  # Debe ser 3.11 o superior

# Verificar pip
pip --version

# Verificar Node.js
node --version  # Debe ser 20.x

# Verificar npm
npm --version  # Debe ser 10.x

# Verificar PostgreSQL
psql --version  # Debe ser 14+

# Verificar Git
git --version
```

**Impacto:** 🟢 BAJO - Pero ayuda a prevenir errores

---

### 🟢 GAP 8: Troubleshooting Común en Setup Inicial

**Estado:** ❌ NO DOCUMENTADO

**Problema:**
- No hay sección de errores comunes durante el primer setup
- Muchos errores típicos de primera vez no están cubiertos

**Necesario:**

| Error | Causa | Solución |
|-------|-------|----------|
| `python: command not found` | Python no instalado | Instalar desde python.org |
| `'pip' is not recognized` | pip no en PATH | Reinstalar Python con "Add to PATH" |
| `node: command not found` | Node.js no instalado | Instalar desde nodejs.org |
| `Cannot connect to database` | PostgreSQL no corriendo | `pg_ctl start` o iniciar servicio |
| `ModuleNotFoundError: app` | No estás en `backend/` o venv no activo | `cd backend && source .venv/bin/activate` |
| `.env` not found | Archivo no creado | `cp ".env copy" .env` |
| `NEXT_PUBLIC_API_URL is undefined` | `.env.local` no existe | `cp .env.example .env.local` |
| Port 8000 already in use | Otro proceso usando el puerto | `lsof -ti:8000 \| xargs kill -9` (Mac/Linux) |
| `alembic: command not found` | venv no activo | Activar venv primero |

**Impacto:** 🟢 BAJO - Pero mejora experiencia

---

### 🟢 GAP 9: Recomendaciones de IDE/Herramientas

**Estado:** ❌ NO DOCUMENTADO

**Problema:**
- No se recomienda ningún IDE o extensiones
- No hay configuración de VSCode (aunque existe `.vscode/` en el repo)

**Necesario:**

```markdown
## Herramientas Recomendadas

### Editor: Visual Studio Code

Extensiones útiles:
- Python (Microsoft)
- Pylance (Microsoft)
- ESLint (Microsoft)
- Prettier (Prettier)
- GitLens (GitKraken)
- Thunder Client (para probar API)

### Clientes de Base de Datos
- pgAdmin 4 (GUI para PostgreSQL)
- DBeaver Community (multiplataforma)

### Clientes API
- Thunder Client (extensión VSCode)
- Postman
- Insomnia

### Terminal
- Windows: PowerShell 7+ (recomendado sobre PowerShell 5.1)
- Mac/Linux: Terminal por defecto
```

**Impacto:** 🟢 BAJO - Opcional pero útil

---

### 🟡 GAP 10: Datos de Prueba y Usuario Demo

**Estado:** ✅ MENCIONADO pero ❌ NO EXPLICADO EN DETALLE

**Problema:**
- Se menciona `demo@example.com` pero no la contraseña
- No se explica qué datos crea el seed
- No hay guía de cómo probar el login

**Necesario:**

```markdown
## Datos de Prueba (después del seed)

### Usuario Demo
- **Email:** demo@example.com
- **Password:** [¿Cuál es? ¿Dónde está definida?]
- **Rol:** [¿Admin? ¿Usuario normal?]

### Datos Creados
El script `seed_sak_backend.py` crea:

1. **Usuarios:**
   - demo@example.com

2. **Artículos:**
   - [Lista de artículos]

3. **Solicitudes:**
   - 1 solicitud demo con detalles

### Cómo Probar
1. Iniciar backend: `uvicorn app.main:app --reload`
2. Iniciar frontend: `npm run dev`
3. Ir a http://localhost:3000/admin
4. Login con:
   - Email: demo@example.com
   - Password: [password]
5. Verificar que aparecen las solicitudes demo
```

**Impacto:** 🟡 MEDIO - Dificulta testing inicial

---

## 📊 Resumen de Gaps

| Gap | Severidad | Estado | Impacto en "Crear desde Cero" |
|-----|-----------|--------|--------------------------------|
| 1. Clonar repositorio | 🔴 CRÍTICO | ❌ Falta | SIN ESTO NO PUEDES EMPEZAR |
| 2. Estructura proyecto | 🟡 MEDIO | ⚠️ Parcial | Causa confusión inicial |
| 3. Crear archivos config | 🔴 CRÍTICO | ❌ Falta | App no arranca |
| 4. Orden de ejecución | 🔴 CRÍTICO | ❌ Falta | Errores y frustración |
| 5. Generar secrets | 🟡 MEDIO | ❌ Falta | Bloquea funcionalidad |
| 6. GCP credentials | 🟡 MEDIO | ⚠️ Existe pero no linkeado | Bloquea GCS local |
| 7. Verificar requisitos | 🟢 BAJO | ❌ Falta | Previene errores |
| 8. Troubleshooting setup | 🟢 BAJO | ❌ Falta | Mejora experiencia |
| 9. Recomendaciones IDE | 🟢 BAJO | ❌ Falta | Opcional pero útil |
| 10. Datos de prueba | 🟡 MEDIO | ⚠️ Parcial | Dificulta testing |

---

## 🎯 Conclusión

### ❌ ¿Se puede crear la app desde cero con la documentación actual?

**NO, no completamente.**

### 🔴 Bloqueadores Críticos (3)

1. **No hay instrucciones de cómo clonar el repo**
2. **No se explica cómo crear archivos .env desde templates**
3. **No hay un flujo secuencial paso a paso**

### 🟡 Problemas Medios (4)

4. Falta explicar cómo generar JWT_SECRET
5. GCP credentials documentado pero no linkeado
6. Estructura del proyecto incompleta
7. Datos de prueba sin contraseña

### 🟢 Mejoras Nice-to-Have (3)

8. Comandos de verificación de requisitos
9. Troubleshooting de errores comunes
10. Recomendaciones de herramientas

---

## ✅ Recomendaciones

### Prioridad ALTA (resolver YA)

1. **Crear `doc/setup/getting-started.md`**
   - Guía completa desde cero
   - Paso a paso secuencial
   - Incluir clonado del repo
   - Incluir creación de archivos .env

2. **Actualizar `doc/setup/README.md`**
   - Agregar sección "Primera vez? Empieza aquí"
   - Linkear a getting-started.md

3. **Mejorar `doc/setup/backend.md`**
   - Agregar sección "Crear .env desde template"
   - Agregar comandos para generar JWT_SECRET
   - Linkear a SETUP_GCP_SECRET.md

### Prioridad MEDIA (siguiente iteración)

4. **Documentar datos de prueba**
   - Contraseña del usuario demo
   - Lista completa de datos seed
   - Guía de testing post-setup

5. **Agregar verificación de requisitos**
   - Comandos para validar versiones
   - Script de validación automática

### Prioridad BAJA (cuando haya tiempo)

6. **Crear doc/setup/tools.md**
   - Recomendaciones de IDE
   - Extensiones útiles
   - Clientes de DB y API

7. **Crear doc/setup/troubleshooting.md**
   - Errores comunes en setup
   - Soluciones documentadas

---

## 📝 Siguiente Acción

Crear `getting-started.md` que unifique todo en un flujo lineal:

```markdown
# Getting Started - SAK desde Cero

1. Prerequisitos
2. Clonar repositorio
3. Setup backend (paso a paso)
4. Setup base de datos
5. Setup frontend (paso a paso)
6. Verificación completa
7. Próximos pasos
```

---

*Análisis completado: Noviembre 2025*
