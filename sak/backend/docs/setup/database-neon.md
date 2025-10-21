# ☁️ Base de Datos en Neon (Producción)

Configuración de PostgreSQL en Neon para el entorno de producción.

---

## ¿Qué es Neon?

Neon es un servicio de PostgreSQL serverless optimizado para aplicaciones modernas.

- **URL:** https://neon.tech
- **Región:** South America East 1 (São Paulo)
- **Plan:** Free tier (hasta 0.5 GB storage)

---

## 1. Credenciales de Producción

### Connection Strings

```bash
# Pooled (recomendado para la mayoría de casos)
DATABASE_URL=postgresql://neondb_owner:npg_***@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require

# Direct (sin pgBouncer, para migraciones)
DATABASE_URL_DIRECT=postgresql://neondb_owner:npg_***@ep-steep-bird-acyo7x0e.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

**⚠️ Nota:** Las credenciales completas están en:
- GitHub Secrets: `DATABASE_URL`
- Cloud Run: Variable de entorno configurada
- Local: Contactar al administrador

---

## 2. Configuración en Desarrollo

Si necesitas conectarte a Neon desde tu máquina local:

### Crear `.env.neon`

```bash
# Neon PostgreSQL (Producción)
DATABASE_URL=postgresql://neondb_owner:***@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require

ENV=dev
SQLALCHEMY_ECHO=0  # No mostrar queries (Neon cobra por tiempo de ejecución)
```

### Cargar Variables

```powershell
# PowerShell
Get-Content .env.neon | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}

# Bash
export $(cat .env.neon | xargs)
```

---

## 3. Diferencias con PostgreSQL Local

### pgBouncer (Connection Pooling)

Neon usa pgBouncer para pooling de conexiones:

- **Pooled URL:** Usar para aplicaciones (FastAPI, workers, etc.)
- **Direct URL:** Usar para migraciones Alembic

### Configuración de Alembic

En `alembic.ini` o al ejecutar migraciones:

```bash
# Usar URL directa para migraciones
alembic upgrade head --url "postgresql://neondb_owner:***@ep-steep-bird-acyo7x0e.sa-east-1.aws.neon.tech/neondb?sslmode=require"
```

### SSL Requerido

Neon **requiere SSL**: `?sslmode=require` en la URL

---

## 4. Ejecutar Migraciones en Neon

```bash
# Opción 1: Variable de entorno
export DATABASE_URL="postgresql://neondb_owner:***@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
alembic upgrade head

# Opción 2: Parámetro directo
alembic upgrade head --url "postgresql://neondb_owner:***@..."
```

---

## 5. Monitoreo en Neon Dashboard

### URL del Dashboard

https://console.neon.tech/app/projects/ep-steep-bird-acyo7x0e

### Métricas Disponibles

- **Storage Used** - Espacio en disco usado
- **Active Connections** - Conexiones activas
- **Query Performance** - Performance de queries
- **Billing** - Uso y cargos

---

## 6. Datos Actuales en Producción

### Usuarios

- 5 usuarios registrados
- Usuario admin: `admin@example.com`

### Nóminas

- 4 nóminas activas

### Facturas

- Archivos PDF en GCS: `gs://sak-wcl-bucket/facturas/`
- URLs públicas: `https://storage.googleapis.com/sak-wcl-bucket/facturas/...`

---

## 7. Backup y Restore

### Backup desde Neon

```bash
# Dump de la base de datos
pg_dump "postgresql://neondb_owner:***@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require" > neon_backup.sql
```

### Restore a Local

```bash
# Restaurar en PostgreSQL local
psql -U sak_user -d sak < neon_backup.sql
```

---

## 8. Limitaciones del Free Tier

| Recurso | Límite |
|---------|--------|
| Storage | 0.5 GB |
| Compute Time | 100 horas/mes |
| Branches | 10 |
| Projects | 1 |

**💡 Tip:** Usar `SQLALCHEMY_ECHO=0` en producción para reducir tiempo de compute.

---

## 🆘 Troubleshooting

### Error: "SSL connection is required"

```bash
# Agregar ?sslmode=require a la URL
DATABASE_URL=postgresql://...?sslmode=require
```

### Error: "Too many connections"

Neon usa pgBouncer con límite de conexiones:

```python
# En app/db.py
engine = create_engine(
    DATABASE_URL,
    pool_size=5,          # Reducir pool
    max_overflow=10,       # Reducir overflow
)
```

### Error: "Database is in sleep mode"

Neon suspende databases inactivas en free tier:

- Primera conexión puede tardar ~3 segundos
- Esto es normal en free tier
- Plan Pro elimina este delay

---

## 📚 Ver También

- [Variables de entorno producción](environment-prod.md)
- [Migraciones](../development/migrations.md)
- [PostgreSQL local](database-local.md)
- [Neon Documentation](https://neon.tech/docs/introduction)
