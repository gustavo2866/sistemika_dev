# Frontend Next.js - Setup verificado

Contenido consolidado a partir de `frontend/README.md`, `frontend/SWITCH_BACKEND.md`, `FRONTEND_READY.md`, `doc/VERCEL_CONFIG.md` y `README_DEPLOY.md`.

> **💡 Primera vez?** Lee primero la guía completa: [Getting Started](getting-started.md)

## 1. Prerrequisitos

- Node.js 20.x (Next.js 15 requiere Node moderno)
- npm 10.x (o superior)
- Git
- Acceso al repositorio y a Vercel

## 2. Instalacion de dependencias

```bash
cd sak/frontend
npm install
```

Scripts disponibles (`package.json`):

- `npm run dev` - servidor de desarrollo
- `npm run build` - build de produccion
- `npm run start` - servidor productivo
- `npm run lint` - ESLint

## 3. Variables de entorno

Archivos relevantes (ver `frontend/README.md`):

```
.env.example      -> template versionado
.env.local        -> desarrollo (ignoreado)
.env.production   -> referencia para Vercel (documentacion)
switch-to-local.ps1 / switch-to-gcp.ps1 -> scripts que editan .env.local
```

Variable requerida:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- **No agregues slash al final.**
- Para apuntar a Cloud Run: `NEXT_PUBLIC_API_URL=https://sak-backend-94464199991.us-central1.run.app`.

### Scripts de cambio rapido

```powershell
cd sak/frontend
.\switch-to-local.ps1   # apunta a http://localhost:8000
.\switch-to-gcp.ps1     # apunta al backend en Cloud Run
```

Despues de ejecutar los scripts reinicia `npm run dev`.

### Edicion manual

```bash
cp .env.example .env.local
code .env.local
```

## 4. Desarrollo local

```bash
npm run dev
```

- URL principal: `http://localhost:3000`
- Panel admin: `http://localhost:3000/admin`
- El frontend consumira `NEXT_PUBLIC_API_URL` (ver consola al iniciar).

Checklist:

1. Confirmar que `.env.local` existe y contiene la URL correcta.
2. Ejecutar `npm run dev`.
3. Observar la consola: Next.js mostrara la URL del backend.
4. Navegar la app y revisar llamadas de red en DevTools.

## 5. Build y pruebas manuales

```bash
npm run build
npm run start
```

Para lint:

```bash
npm run lint
```

## 6. Conexion con backend

- **Backend local:** ejecutar `uvicorn app.main:app --reload` y `.\switch-to-local.ps1`.
- **Backend GCP/QA:** ejecutar `.\switch-to-gcp.ps1`.
- **Validacion rapida:** `curl $env:NEXT_PUBLIC_API_URL/health` (PowerShell) o `curl $NEXT_PUBLIC_API_URL/health` (Bash).

## 7. Deploy en Vercel

Segun `doc/VERCEL_CONFIG.md` y `FRONTEND_READY.md`:

1. Ir a <https://vercel.com/dashboard> y abrir el proyecto (`sistemika-sak-frontend` / `wcl-seven`).
2. Configurar `Settings -> Git -> Production Branch = master`.
3. Configurar `Settings -> Environment Variables`:
   ```
   Key: NEXT_PUBLIC_API_URL
   Value: https://sak-backend-94464199991.us-central1.run.app
   Environments: Production, Preview, Development
   ```
4. Guardar y forzar un `Redeploy` desde `Deployments`.
5. Confirmar que cada push a `master` dispara un nuevo deploy (Vercel se integra con GitHub).

## 8. Troubleshooting

| Problema | Solucion |
| -------- | -------- |
| Cambie la URL pero el frontend sigue apuntando al valor viejo | Reinicia `npm run dev` despues de editar `.env.local`. |
| `NEXT_PUBLIC_API_URL` es `undefined` | `.env.local` no existe o no tiene la variable. Copia desde `.env.example`. |
| CORS bloquea requests | Agrega la URL del frontend a `CORS_ORIGINS` en `backend/.env` y reinicia Uvicorn. |
| Deploy en Vercel falla | Revisar logs de build en el dashboard, confirmar que `npm run build` pasa en local y que `NEXT_PUBLIC_API_URL` esta cargado. |
| Frontend local no alcanza Cloud Run | Ejecuta `.\switch-to-gcp.ps1` y usa `curl https://sak-backend-94464199991.us-central1.run.app/health` para confirmar. |

## 9. Referencias y fuentes

- `frontend/README.md`
- `frontend/SWITCH_BACKEND.md`
- `FRONTEND_READY.md`
- `doc/VERCEL_CONFIG.md`
- `README_DEPLOY.md`
