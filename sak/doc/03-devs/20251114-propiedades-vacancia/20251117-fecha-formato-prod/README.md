# Despliegue cambio de formato de fecha (producción)

Checklist y scripts locales para preparar datos y validar el despliegue automatizado (GitHub Actions → Cloud Run/Vercel). No se guardan credenciales aquí; usa la URL de Neon ya documentada (`doc/01-setup/environments.md`).

## Flujo resumido
- **Backup Neon prod** antes de cualquier cambio.
- **Aplicar migración Alembic** a HEAD (en prod) para convertir columnas a `DATE` (`2b6cc3ddf3d1_convert_vacancia_dates_to_date`).
- **Adecuar datos en prod**: normalizar/ajustar fechas con `02-fix-dates-prod.sql` (sin importar datos de desarrollo).
- **Validar**: ejecutar queries de consistencia (`03-validate-prod.sql`).
- **Despliegue de código**: merge/push a `master`; GitHub Actions despliega backend a Cloud Run y Vercel construye frontend automáticamente.

## Scripts en esta carpeta
- `00-run-alembic-prod.ps1`: ejecuta `alembic upgrade head` apuntando a prod (usa `DATABASE_URL_PROD_DIRECT`).
- `01-backup-prod.ps1`: backup completo de Neon prod.
- `02-fix-dates-prod.sql`: SQL para ajustar/normalizar fechas tras la migración a `DATE` (sin importar datos de dev).
- `03-validate-prod.sql`: queries de integridad y orden de fechas en prod.

## Variables de conexión (ejemplo)
Usa el string pooled para operaciones normales y el directo (sin `-pooler`) para migraciones pesadas:
```
postgresql://neondb_owner:<password>@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

### Tips
- Ejecuta `psql`/`pg_dump` con `PGPASSWORD` en el entorno o usando el flag `-W` (no guardes contraseñas en archivos).
- Los dumps generados por los scripts quedan en este mismo directorio para identificarlos fácilmente.
