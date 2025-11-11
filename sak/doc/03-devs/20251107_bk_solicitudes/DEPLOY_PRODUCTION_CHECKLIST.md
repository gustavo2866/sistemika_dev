# 🚀 Deploy a Producción - Quick Reference
**Fecha:** ____________  
**Responsable:** ____________  
**Inicio:** ____:____  **Fin:** ____:____

---

## ⚠️ ANTES DE EMPEZAR

### Pre-Requisitos Obligatorios
- [ ] ✅ Tests pasan en local: `pytest -v`
- [ ] ✅ Frontend probado E2E contra backend local
- [ ] ✅ Build de producción exitoso: `npm run build`
- [ ] ✅ Stakeholders notificados
- [ ] ✅ Equipo disponible para monitorear

---

## 🔒 PASO 1: BACKUP (15 min)
**⏰ Inicio:** ____:____

```powershell
cd c:\Users\gpalmieri\source\sistemika\sak\backend

# Crear backup
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
pg_dump $env:DATABASE_URL_PRODUCTION -f ".\backups\backup_prod_$timestamp.sql"

# Comprimir
Compress-Archive -Path ".\backups\backup_prod_$timestamp.sql" -DestinationPath ".\backups\backup_prod_$timestamp.zip"

# Copiar a OneDrive
Copy-Item ".\backups\backup_prod_$timestamp.zip" -Destination "C:\Users\gpalmieri\OneDrive\Backups\SAK\"
```

### ✅ Verificación
- [ ] Backup creado: `backup_prod_YYYYMMDD_HHmmss.zip`
- [ ] Tamaño: ______ MB (verificar que no es 0)
- [ ] Copiado a OneDrive: ✅

**⏰ Fin:** ____:____

---

## 🔀 PASO 2: MERGE A MASTER (5 min)
**⏰ Inicio:** ____:____

```powershell
cd c:\Users\gpalmieri\source\sistemika\sak

git checkout feature/solicitudes-refactor
git pull origin feature/solicitudes-refactor

git checkout master
git pull origin master

git merge feature/solicitudes-refactor
# Si hay conflictos, resolver y: git add . && git commit

git push origin master
```

### ✅ Verificación
- [ ] Merge exitoso sin conflictos
- [ ] Push a master: ✅
- [ ] GitHub Actions OK (si aplica)

**⏰ Fin:** ____:____

---

## 🗄️ PASO 3: MIGRACIONES (30 min)
**⏰ Inicio:** ____:____

### 3.1 Configurar Conexión a Producción
```powershell
cd c:\Users\gpalmieri\source\sistemika\sak\backend
$env:DATABASE_URL = $env:DATABASE_URL_PRODUCTION
```

### 3.2 Verificar Estado Actual
```powershell
alembic current
# Anotar: ______________________
```

### 3.3 Migración 0020 - Departamentos
```powershell
alembic upgrade +1

# Verificar tabla
python -c "from sqlalchemy import inspect; from app.db import engine; print('departamentos' in inspect(engine).get_table_names())"
```
- [ ] Tabla `departamentos` creada: ✅

### 3.4 Seed Departamentos
```powershell
python scripts/seed_departamentos.py

# Verificar
python -c "from sqlmodel import Session, select; from app.db import engine; from app.models import Departamento; session = Session(engine); print(f'Departamentos: {len(session.exec(select(Departamento)).all())}')"
```
- [ ] 4 departamentos creados: ✅

### 3.5 Migración 0021 - Tipos Solicitud
```powershell
alembic upgrade +1

# Verificar tabla
python -c "from sqlalchemy import inspect; from app.db import engine; print('tipos_solicitud' in inspect(engine).get_table_names())"
```
- [ ] Tabla `tipos_solicitud` creada: ✅

### 3.6 Seed Tipos Solicitud
```powershell
python scripts/seed_tipos_solicitud.py

# Verificar
python -c "from sqlmodel import Session, select; from app.db import engine; from app.models import TipoSolicitud; session = Session(engine); print(f'Tipos: {len(session.exec(select(TipoSolicitud)).all())}')"
```
- [ ] 6 tipos creados: ✅

### 3.7 Migración 0022 - Refactor Solicitudes ⚠️ CRÍTICO
```powershell
# Contar solicitudes antes
python -c "from sqlmodel import Session, select; from app.db import engine; from app.models import Solicitud; session = Session(engine); print(f'Solicitudes antes: {len(session.exec(select(Solicitud)).all())}')"
# Anotar: ______ solicitudes

alembic upgrade +1

# Verificar columnas
python -c "from sqlalchemy import inspect; from app.db import engine; cols = [c['name'] for c in inspect(engine).get_columns('solicitudes')]; print('Nuevas columnas:'); print('  tipo_solicitud_id:', 'tipo_solicitud_id' in cols); print('  departamento_id:', 'departamento_id' in cols); print('  estado:', 'estado' in cols); print('  total:', 'total' in cols); print('  tipo (debe ser False):', 'tipo' in cols)"
```
- [ ] Columnas nuevas agregadas: ✅
- [ ] Columna `tipo` eliminada: ✅

### 3.8 Verificar Integridad de Datos
```powershell
python -c "from sqlmodel import Session, select; from app.db import engine; from app.models import Solicitud; session = Session(engine); sols = session.exec(select(Solicitud)).all(); print(f'Solicitudes después: {len(sols)}'); invalidas = [s for s in sols if not s.tipo_solicitud_id or not s.departamento_id]; print(f'Solicitudes inválidas: {len(invalidas)}')"
```
- [ ] Mismo número de solicitudes: ______
- [ ] 0 solicitudes inválidas: ✅

### 3.9 Estado Final
```powershell
alembic current
# Debe mostrar: 0022_refactor_solicitudes_add_tipo_departamento (head)
```
- [ ] Migración 0022 aplicada: ✅

**⏰ Fin:** ____:____

---

## 🚀 PASO 4: DEPLOY BACKEND (10 min)
**⏰ Inicio:** ____:____

### Deploy Automático (Railway/Fly.io)
```powershell
# El push a master ya triggereó el deploy

# Monitorear logs
railway logs --tail 50
# O: fly logs
# O: heroku logs -a sak-backend
```

### ✅ Verificación
- [ ] Deploy completado sin errores
- [ ] API responde: `curl https://tu-backend-production.com/health`
- [ ] Swagger funcional: `start https://tu-backend-production.com/docs`

### Probar Endpoints en Swagger
- [ ] GET `/departamentos` → 4 registros
- [ ] GET `/tipos-solicitud` → 6 registros
- [ ] GET `/solicitudes` → Solicitudes con nuevos campos
- [ ] GET `/solicitudes/{id}` → Verificar `tipo_solicitud_id`, `departamento_id`, `estado`, `total`

**⏰ Fin:** ____:____

---

## 🎨 PASO 5: DEPLOY FRONTEND (15 min)
**⏰ Inicio:** ____:____

### 5.1 Verificar Variables de Entorno
```powershell
cd c:\Users\gpalmieri\source\sistemika\sak\frontend

Get-Content .env.production | Select-String "NEXT_PUBLIC_API_URL"
# Debe apuntar a: https://tu-backend-production.com
```
- [ ] `.env.production` correcto: ✅

### 5.2 Build Local (Opcional)
```powershell
npm run build
```
- [ ] Build exitoso: ✅

### 5.3 Deploy a Vercel
```powershell
# Opción A: Automático (si Vercel está conectado a GitHub)
# El push a master ya triggereó el deploy

# Opción B: Manual
vercel --prod

# Monitorear en dashboard
start https://vercel.com/tu-cuenta/sak-frontend
```

### ✅ Verificación
- [ ] Deploy completado sin errores
- [ ] Frontend accesible: `start https://tu-frontend-production.vercel.app`
- [ ] Sin errores en Console (F12)

**⏰ Fin:** ____:____

---

## ✅ PASO 6: VERIFICACIÓN E2E (20 min)
**⏰ Inicio:** ____:____

### Pruebas Manuales

#### Test 1: Crear Solicitud Nueva
- [ ] Navegar a `/solicitudes`
- [ ] Click "Nueva Solicitud"
- [ ] Seleccionar tipo: "Materiales"
- [ ] Seleccionar departamento: "Compras"
- [ ] Agregar detalles (artículos)
- [ ] Guardar
- [ ] Verificar que se creó: ID = ______

#### Test 2: Ver Solicitud Existente
- [ ] Abrir solicitud antigua (creada antes del deploy)
- [ ] Verificar que tiene `tipo_solicitud_id`: ______
- [ ] Verificar que tiene `departamento_id`: ______
- [ ] Verificar que tiene `estado`: ______

#### Test 3: Editar Estado
- [ ] Abrir solicitud ID: ______
- [ ] Cambiar estado a "Aprobada"
- [ ] Guardar
- [ ] Recargar página
- [ ] Verificar estado persistido: ✅

#### Test 4: Filtros
- [ ] Filtrar por departamento "Compras"
- [ ] Filtrar por tipo "Materiales"
- [ ] Filtrar por estado "Pendiente"
- [ ] Todos los filtros funcionan: ✅

### Verificación de Datos en DB
```powershell
$env:DATABASE_URL = $env:DATABASE_URL_PRODUCTION

python -c @"
from sqlmodel import Session, select
from app.db import engine
from app.models import Departamento, TipoSolicitud, Solicitud
from collections import Counter

with Session(engine) as session:
    print('=== RESUMEN POST-DEPLOY ===')
    
    depts = session.exec(select(Departamento)).all()
    print(f'\nDepartamentos: {len(depts)}')
    
    tipos = session.exec(select(TipoSolicitud)).all()
    print(f'Tipos: {len(tipos)}')
    
    sols = session.exec(select(Solicitud)).all()
    print(f'Solicitudes: {len(sols)}')
    
    dept_dist = Counter(s.departamento_id for s in sols)
    print(f'\nPor departamento:')
    for dept_id, count in dept_dist.items():
        dept = session.get(Departamento, dept_id)
        print(f'  {dept.nombre}: {count}')
    
    estado_dist = Counter(s.estado for s in sols)
    print(f'\nPor estado:')
    for estado, count in estado_dist.items():
        print(f'  {estado}: {count}')
"@
```

### ✅ Todas las Pruebas Pasaron
- [ ] ✅ Crear nueva solicitud funciona
- [ ] ✅ Solicitudes antiguas tienen tipo/dept
- [ ] ✅ Cambiar estado funciona
- [ ] ✅ Filtros funcionan
- [ ] ✅ Datos consistentes en DB

**⏰ Fin:** ____:____

---

## 📊 PASO 7: MONITOREO INICIAL (30 min)
**⏰ Inicio:** ____:____

### Logs de Backend
```powershell
railway logs --tail 100 | Select-String -Pattern "error|exception|500|400" -Context 2
```
- [ ] Sin errores críticos: ✅

### Performance
```powershell
Measure-Command { curl https://tu-backend-production.com/solicitudes }
# Tiempo: ______ segundos (debe ser < 2s)
```
- [ ] Tiempo de respuesta aceptable: ✅

### Frontend Console
- [ ] Abrir F12 en navegador
- [ ] Navegar por la app
- [ ] Sin errores en Console: ✅

### Métricas
- [ ] Revisar Vercel Analytics (si disponible)
- [ ] Revisar Railway/Fly.io Metrics (si disponible)

**⏰ Fin:** ____:____

---

## 📝 PASO 8: DOCUMENTACIÓN Y COMUNICACIÓN

### Notificar a Stakeholders
- [ ] Enviar email de deploy exitoso
- [ ] Incluir estadísticas:
  - Solicitudes migradas: ______
  - Departamentos: 4
  - Tipos: 6
  - Downtime: ______ minutos (si hubo)

### Actualizar Documentación
- [ ] Marcar `IMPLEMENTATION_GUIDE.md` como completado
- [ ] Actualizar fecha de deploy en `20251107_bk_solicitudes_spec.md`
- [ ] Agregar notas de deploy (si hay algo relevante)

### Commit Final
```powershell
git add doc/03-devs/20251107_bk_solicitudes/
git commit -m "docs: mark solicitudes refactor as deployed to production"
git push origin master
```
- [ ] Documentación actualizada: ✅

---

## 🎉 DEPLOY COMPLETADO

**✅ Todos los pasos completados exitosamente**

### Resumen Final
- **Inicio del deploy:** ____:____
- **Fin del deploy:** ____:____
- **Duración total:** ______ minutos
- **Downtime:** ______ minutos
- **Problemas encontrados:** ____________________________________________
- **Rollbacks necesarios:** [ ] Sí  [ ] No

### Próximos Pasos (Post-Deploy)
- [ ] Monitorear logs las próximas 2 horas
- [ ] Responder a reportes de usuarios inmediatamente
- [ ] Después de 48h: Eliminar branch de feature
- [ ] Después de 48h: Archivar backups
- [ ] Documentar lecciones aprendidas

---

## 🆘 ROLLBACK RÁPIDO (Si algo sale mal)

### Problema: Frontend no funciona
```powershell
vercel rollback https://tu-frontend-production.vercel.app
```
⏱️ 2 minutos

### Problema: Backend con errores (solo código)
```powershell
git revert HEAD
git push origin master
```
⏱️ 5 minutos

### Problema: Migraciones fallidas
```powershell
$env:DATABASE_URL = $env:DATABASE_URL_PRODUCTION
alembic downgrade -1  # Repetir 3 veces
```
⏱️ 15 minutos

### Problema: Corrupción de datos
```powershell
# Restaurar desde backup
psql $env:DATABASE_URL_PRODUCTION -f ".\backups\backup_prod_YYYYMMDD_HHmmss.sql"
git revert HEAD
git push origin master
vercel rollback https://tu-frontend-production.vercel.app
```
⏱️ 30 minutos

---

## 📞 Contactos de Emergencia

| Rol | Contacto | Teléfono |
|-----|----------|----------|
| Dev Lead | Gustavo Palmieri | ___________ |
| DevOps | ________________ | ___________ |
| DBA | ________________ | ___________ |

---

**Responsable del deploy:** ____________________  
**Firma:** ____________________ **Fecha:** __________
