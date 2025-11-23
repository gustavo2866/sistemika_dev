# Backup selectivo de tablas CRM antes de migración
# Solo respalda las tablas que serán creadas/modificadas por la migración CRM

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "BACKUP SELECTIVO - Tablas CRM" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Set-Location ..\backend

# Obtener DATABASE_URL de GCP Secret Manager
Write-Host "`nObteniendo credenciales de producción..." -ForegroundColor Yellow
$DATABASE_URL = gcloud secrets versions access latest --secret="DATABASE_URL" --project="sak-wcl"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al obtener DATABASE_URL" -ForegroundColor Red
    Set-Location ..\cmd
    exit 1
}

# Parsear DATABASE_URL para obtener credenciales
# Formato: postgresql://user:pass@host:port/dbname
if ($DATABASE_URL -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $DB_USER = $matches[1]
    $DB_PASS = $matches[2]
    $DB_HOST = $matches[3]
    $DB_PORT = $matches[4]
    $DB_NAME = $matches[5]
    
    # Limpiar query string si existe (ej: ?sslmode=require)
    if ($DB_NAME -match "([^\?]+)") {
        $DB_NAME = $matches[1]
    }
} else {
    Write-Host "Error: No se pudo parsear DATABASE_URL" -ForegroundColor Red
    Set-Location ..\cmd
    exit 1
}

Write-Host "Base de datos: $DB_NAME@$DB_HOST" -ForegroundColor Green

# Crear directorio de backups si no existe
$BACKUP_DIR = "..\backups"
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

# Nombre del archivo de backup
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$BACKUP_DIR\backup_crm_selective_$TIMESTAMP.sql"

Write-Host "`nCreando backup selectivo en: $BACKUP_FILE" -ForegroundColor Yellow

# Lista de tablas a respaldar
$TABLES = @(
    # Tablas que serán CREADAS (backup preventivo, estarán vacías)
    "crm_tipos_operacion",
    "crm_motivos_perdida",
    "crm_condiciones_pago",
    "crm_tipos_evento",
    "crm_motivos_evento",
    "crm_origenes_lead",
    "monedas",
    "cotizacion_moneda",
    "emprendimientos",
    "crm_contactos",
    "crm_oportunidades",
    "crm_oportunidad_log_estado",
    "crm_eventos",
    
    # Tabla que será MODIFICADA (backup de datos actuales)
    "propiedades"
)

# Crear archivo de backup con header
@"
-- ========================================
-- BACKUP SELECTIVO - Tablas CRM
-- Fecha: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
-- Base de datos: $DB_NAME
-- Host: $DB_HOST
-- ========================================
-- 
-- Este backup contiene:
-- 1. Estructura y datos de tabla 'propiedades' (se modificará)
-- 2. Estructura de tablas CRM (se crearán desde cero)
--
-- IMPORTANTE: Las tablas CRM no existen aún, este backup
-- es preventivo para poder restaurar el estado previo
-- si algo falla durante la migración.
--
-- ========================================

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

"@ | Out-File -FilePath $BACKUP_FILE -Encoding UTF8

Write-Host "`nRespaldando tablas:" -ForegroundColor Cyan

foreach ($TABLE in $TABLES) {
    # Verificar si la tabla existe
    $CHECK_SQL = "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$TABLE');"
    
    $env:PGPASSWORD = $DB_PASS
    $EXISTS = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $CHECK_SQL 2>$null
    Remove-Item Env:\PGPASSWORD
    
    if ($EXISTS -match "t|true") {
        Write-Host "  ✅ $TABLE (existe - respaldando datos)" -ForegroundColor Green
        
        # Respaldar estructura y datos
        $env:PGPASSWORD = $DB_PASS
        & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME `
            --table=$TABLE `
            --no-owner `
            --no-acl `
            --column-inserts `
            --if-exists `
            >> $BACKUP_FILE 2>$null
        Remove-Item Env:\PGPASSWORD
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "    ⚠️  Error al respaldar $TABLE" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⏭️  $TABLE (no existe - será creada)" -ForegroundColor Gray
        
        # Agregar comentario al backup
        @"

-- ----------------------------------------
-- Tabla: $TABLE
-- Estado: No existe en la base actual
-- Acción: Será creada por la migración
-- ----------------------------------------

"@ | Out-File -FilePath $BACKUP_FILE -Encoding UTF8 -Append
    }
}

# Agregar información adicional al final
@"

-- ========================================
-- FIN DEL BACKUP SELECTIVO
-- ========================================
-- 
-- Para restaurar este backup:
-- psql -h HOST -U USER -d DB -f $BACKUP_FILE
--
-- IMPORTANTE: Solo restaurar si necesitas
-- revertir la migración CRM y volver al
-- estado anterior.
-- ========================================
"@ | Out-File -FilePath $BACKUP_FILE -Encoding UTF8 -Append

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ BACKUP COMPLETADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Archivo: $BACKUP_FILE" -ForegroundColor White
Write-Host "Tamaño: $((Get-Item $BACKUP_FILE).Length / 1KB) KB" -ForegroundColor White

# Mostrar resumen
Write-Host "`nResumen del backup:" -ForegroundColor Yellow
Write-Host "  - Tabla propiedades: estructura + datos actuales" -ForegroundColor White
Write-Host "  - Tablas CRM: referencias (no existen aun)" -ForegroundColor White
Write-Host "`nEste backup permite:" -ForegroundColor Yellow
Write-Host "  OK Restaurar propiedades si la migracion falla" -ForegroundColor Green
Write-Host "  OK Documentar el estado pre-migracion" -ForegroundColor Green
Write-Host "  OK Rollback completo si es necesario" -ForegroundColor Green

Set-Location ..\cmd

Write-Host "`nListo para ejecutar migracion!" -ForegroundColor Cyan
Write-Host "Siguiente paso: mig_prod.ps1" -ForegroundColor White
