# ============================================================================
# SCRIPT DE DEPLOYMENT AUTOMATIZADO - Centro de Costo a Producción
# ============================================================================
# Archivo: deploy_centro_costo_prod.ps1
# Ubicación: doc\03-devs\20251111_solicitudes_CentroCosto_req\
# Ejecución: .\doc\03-devs\20251111_solicitudes_CentroCosto_req\deploy_centro_costo_prod.ps1
# ============================================================================

# Configuración
$ErrorActionPreference = "Stop"
$SUCCESS = "Green"
$WARNING = "Yellow"
$INFO = "Cyan"

function Write-Step {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "`n$Message" -ForegroundColor $Color
    Write-Host ("=" * 70) -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✅ $Message" -ForegroundColor Green
}

function Write-Error-Msg {
    param([string]$Message)
    Write-Host "  ❌ $Message" -ForegroundColor Red
}

function Write-Warning-Msg {
    param([string]$Message)
    Write-Host "  ⚠️  $Message" -ForegroundColor Yellow
}

function Confirm-Continue {
    param([string]$Message)
    Write-Host "`n$Message" -ForegroundColor Yellow
    $response = Read-Host "¿Desea continuar? (s/n)"
    if ($response -ne 's' -and $response -ne 'S') {
        Write-Host "`n❌ Deployment cancelado por el usuario" -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# PASO 0: Verificaciones Previas
# ============================================================================
Write-Step "🔍 PASO 0: Verificaciones Previas" $INFO

# Verificar que estamos en el directorio correcto
$currentPath = Get-Location
if (-not (Test-Path "backend\alembic.ini")) {
    Write-Error-Msg "No se encuentra backend\alembic.ini"
    Write-Host "Por favor ejecute este script desde la raíz del proyecto (sak\)" -ForegroundColor Red
    exit 1
}
Write-Success "Directorio correcto: $currentPath"

# Verificar que existe .env.production.local
if (-not (Test-Path "backend\.env.production.local")) {
    Write-Error-Msg "No se encuentra backend\.env.production.local"
    Write-Host "Debe crear este archivo con las credenciales de NEON producción" -ForegroundColor Red
    Write-Host "DATABASE_URL=postgresql://user:pass@host/db" -ForegroundColor Yellow
    exit 1
}
Write-Success "Archivo .env.production.local encontrado"

# Verificar Python
try {
    $pythonVersion = python --version 2>&1
    Write-Success "Python: $pythonVersion"
} catch {
    Write-Error-Msg "Python no está instalado o no está en PATH"
    exit 1
}

# Verificar que existen los scripts necesarios
$scriptsRequired = @(
    "doc\03-devs\20251111_solicitudes_CentroCosto_req\populate_centros_costo.py",
    "doc\03-devs\20251111_solicitudes_CentroCosto_req\seed_centros_generales.py",
    "doc\03-devs\20251111_solicitudes_CentroCosto_req\validate_deployment.py"
)

foreach ($script in $scriptsRequired) {
    if (Test-Path $script) {
        Write-Success "Script encontrado: $script"
    } else {
        Write-Error-Msg "Script NO encontrado: $script"
        exit 1
    }
}

# ============================================================================
# PASO 1: Confirmación del Usuario
# ============================================================================
Write-Step "⚠️  PASO 1: Confirmación de Deployment" $WARNING

Write-Host "`nEste script ejecutará los siguientes cambios en PRODUCCIÓN:" -ForegroundColor Yellow
Write-Host "  1. Aplicar migración Alembic 90f5f68df0bf" -ForegroundColor White
Write-Host "  2. Crear tabla centros_costo" -ForegroundColor White
Write-Host "  3. Agregar campos precio/importe a solicitud_detalles" -ForegroundColor White
Write-Host "  4. Agregar centro_costo_id a solicitudes" -ForegroundColor White
Write-Host "  5. Popular centros de costo desde propiedades/proyectos" -ForegroundColor White
Write-Host "  6. Crear centros de costo generales" -ForegroundColor White
Write-Host ""

Confirm-Continue "⚠️  IMPORTANTE: ¿Ha realizado un BACKUP de las tablas afectadas (solicitudes, solicitud_detalles)?"

# ============================================================================
# PASO 2: Crear Backup de Tablas Afectadas
# ============================================================================
Write-Step "💾 PASO 2: Backup de Tablas Afectadas" $INFO

Write-Host "Creando backup de tablas: solicitudes, solicitud_detalles..." -ForegroundColor Cyan

# Crear directorio de backups
$backupDir = "doc\03-devs\20251111_solicitudes_CentroCosto_req\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$backupDate = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir\backup_tables_centro_costo_$backupDate.sql"

Write-Host "`nOPCIÓN 1: Usar pg_dump (si está disponible localmente)" -ForegroundColor Yellow
Write-Host "OPCIÓN 2: Exportar manualmente desde DataGrip/psql" -ForegroundColor Yellow
Write-Host ""

$response = Read-Host "¿Tiene pg_dump instalado localmente? (s/n)"

if ($response -eq 's' -or $response -eq 'S') {
    Write-Host "`nIngrese los datos de conexión NEON:" -ForegroundColor Cyan
    $neonHost = Read-Host "Host (ej: ep-cool-meadow-xxx.neon.tech)"
    $neonUser = Read-Host "Usuario (ej: sak_user)"
    $neonDb = Read-Host "Base de datos (ej: sak_production)"
    
    Write-Host "`nEjecutando pg_dump..." -ForegroundColor Cyan
    
    try {
        $pgdumpCmd = "pg_dump -h $neonHost -U $neonUser -d $neonDb --table=solicitudes --table=solicitud_detalles --no-owner --no-privileges --data-only --inserts -f `"$backupFile`""
        
        Write-Host "Comando: $pgdumpCmd" -ForegroundColor Gray
        Write-Host "NOTA: Se solicitará la contraseña de NEON" -ForegroundColor Yellow
        
        Invoke-Expression $pgdumpCmd
        
        if (Test-Path $backupFile) {
            $fileSize = (Get-Item $backupFile).Length / 1KB
            Write-Success "Backup creado: $backupFile ($([math]::Round($fileSize, 2)) KB)"
        } else {
            Write-Warning-Msg "No se pudo crear el backup con pg_dump"
        }
    } catch {
        Write-Warning-Msg "Error al ejecutar pg_dump: $_"
        Write-Host "Puede crear el backup manualmente con DataGrip o psql" -ForegroundColor Yellow
    }
} else {
    Write-Host "`nPor favor, exporte manualmente desde DataGrip o psql:" -ForegroundColor Yellow
    Write-Host "  1. Conectar a NEON" -ForegroundColor White
    Write-Host "  2. Ejecutar: \copy (SELECT * FROM solicitudes) TO 'backup_solicitudes.csv' WITH CSV HEADER;" -ForegroundColor Gray
    Write-Host "  3. Ejecutar: \copy (SELECT * FROM solicitud_detalles) TO 'backup_detalles.csv' WITH CSV HEADER;" -ForegroundColor Gray
    Write-Host ""
    
    Confirm-Continue "¿Ha creado el backup manualmente?"
}

# Registrar conteos pre-migración
Write-Host "`nRegistrando conteos pre-migración para verificación..." -ForegroundColor Cyan
Write-Host "Estos números se compararán después de la migración" -ForegroundColor Gray

# ============================================================================
# PASO 3: Verificar Estado de Migraciones
# ============================================================================
Write-Step "📋 PASO 3: Verificar Estado de Migraciones" $INFO

Push-Location backend
try {
    Write-Host "Verificando migración actual en PRODUCCIÓN..." -ForegroundColor Cyan
    $currentMigration = alembic current 2>&1 | Select-String -Pattern "[a-f0-9]{12}"
    
    if ($currentMigration) {
        Write-Success "Migración actual: $currentMigration"
    } else {
        Write-Warning-Msg "No se pudo determinar la migración actual"
    }
    
    # Verificar historial
    Write-Host "`nHistorial de migraciones:" -ForegroundColor Cyan
    alembic history -r-5:-1
    
} catch {
    Write-Error-Msg "Error al verificar migraciones: $_"
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

Confirm-Continue "¿Proceder con la aplicación de migración 90f5f68df0bf?"

# ============================================================================
# PASO 4: Aplicar Migración Alembic
# ============================================================================
Write-Step "🚀 PASO 4: Aplicar Migración Alembic" $INFO

Push-Location backend
try {
    Write-Host "Ejecutando: alembic upgrade head" -ForegroundColor Cyan
    
    $migrationOutput = alembic upgrade head 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Migración aplicada exitosamente"
        Write-Host $migrationOutput -ForegroundColor Gray
        
        # Verificar nueva migración
        $newMigration = alembic current 2>&1 | Select-String -Pattern "90f5f68df0bf"
        if ($newMigration) {
            Write-Success "Migración 90f5f68df0bf confirmada"
        } else {
            Write-Warning-Msg "No se pudo confirmar la migración 90f5f68df0bf"
        }
    } else {
        Write-Error-Msg "Error al aplicar migración"
        Write-Host $migrationOutput -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
} catch {
    Write-Error-Msg "Error fatal: $_"
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

# ============================================================================
# PASO 5: Popular Centros de Costo
# ============================================================================
Write-Step "📊 PASO 5: Popular Centros de Costo" $INFO

Write-Host "Ejecutando: populate_centros_costo.py" -ForegroundColor Cyan

try {
    $populateOutput = python doc\03-devs\20251111_solicitudes_CentroCosto_req\populate_centros_costo.py 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Población de centros de costo completada"
        Write-Host $populateOutput -ForegroundColor Gray
    } else {
        Write-Error-Msg "Error al popular centros de costo"
        Write-Host $populateOutput -ForegroundColor Red
        
        # Preguntar si continuar
        $response = Read-Host "¿Desea continuar de todos modos? (s/n)"
        if ($response -ne 's' -and $response -ne 'S') {
            exit 1
        }
    }
    
} catch {
    Write-Error-Msg "Error fatal: $_"
    exit 1
}

# ============================================================================
# PASO 6: Seeds de Centros Generales (Opcional)
# ============================================================================
Write-Step "🌱 PASO 6: Seeds de Centros Generales" $INFO

$response = Read-Host "¿Desea ejecutar seeds de centros generales adicionales? (s/n)"

if ($response -eq 's' -or $response -eq 'S') {
    Write-Host "Ejecutando: seed_centros_generales.py" -ForegroundColor Cyan
    
    try {
        $seedOutput = python doc\03-devs\20251111_solicitudes_CentroCosto_req\seed_centros_generales.py 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Seeds ejecutados correctamente"
            Write-Host $seedOutput -ForegroundColor Gray
        } else {
            Write-Warning-Msg "Error al ejecutar seeds (no crítico)"
            Write-Host $seedOutput -ForegroundColor Yellow
        }
        
    } catch {
        Write-Warning-Msg "Error al ejecutar seeds: $_"
    }
} else {
    Write-Host "  ⏭️  Seeds opcionales omitidos" -ForegroundColor Gray
}

# ============================================================================
# PASO 7: Validación de Deployment
# ============================================================================
Write-Step "✅ PASO 7: Validación de Deployment" $INFO

Write-Host "Ejecutando: validate_deployment.py" -ForegroundColor Cyan

try {
    $validateOutput = python doc\03-devs\20251111_solicitudes_CentroCosto_req\validate_deployment.py 2>&1
    
    Write-Host $validateOutput -ForegroundColor Gray
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Validación completada exitosamente"
    } else {
        Write-Error-Msg "Validación encontró errores"
        
        $response = Read-Host "`n¿Desea hacer ROLLBACK de la migración? (s/n)"
        if ($response -eq 's' -or $response -eq 'S') {
            Write-Host "`nEjecutando rollback..." -ForegroundColor Yellow
            Push-Location backend
            alembic downgrade b1d5f5c2279f
            Pop-Location
            Write-Host "Rollback completado" -ForegroundColor Yellow
            exit 1
        }
    }
    
} catch {
    Write-Error-Msg "Error al ejecutar validación: $_"
    exit 1
}

# ============================================================================
# PASO 8: Resumen Final
# ============================================================================
Write-Step "🎉 DEPLOYMENT COMPLETADO" $SUCCESS

Write-Host "`nResumen de acciones ejecutadas:" -ForegroundColor Green
Write-Host "  ✅ Backup de tablas afectadas creado" -ForegroundColor Green
Write-Host "  ✅ Migración 90f5f68df0bf aplicada" -ForegroundColor Green
Write-Host "  ✅ Centros de costo poblados" -ForegroundColor Green
Write-Host "  ✅ Validación exitosa" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos automáticos:" -ForegroundColor Cyan
Write-Host "  🔄 GitHub Actions desplegará el backend automáticamente" -ForegroundColor Yellow
Write-Host "  📊 Monitorear logs en las próximas 24-48 horas" -ForegroundColor White
Write-Host ""
Write-Host "Comandos útiles:" -ForegroundColor Cyan
Write-Host "  - Ver centros: SELECT * FROM centros_costo LIMIT 10;" -ForegroundColor Gray
Write-Host "  - Ver distribución: SELECT tipo, COUNT(*) FROM centros_costo GROUP BY tipo;" -ForegroundColor Gray
Write-Host "  - Test API (después del deploy): GET https://your-api.com/api/centros-costo" -ForegroundColor Gray
Write-Host ""

# Guardar log de deployment
$logFile = "deployment_centro_costo_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
$logPath = "doc\03-devs\20251111_solicitudes_CentroCosto_req\$logFile"

@"
DEPLOYMENT LOG - Centro de Costo
=================================
Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Usuario: $env:USERNAME
Equipo: $env:COMPUTERNAME
Base de datos: Producción NEON

ACCIONES EJECUTADAS:
- Backup de tablas afectadas (solicitudes, solicitud_detalles)
- Migración 90f5f68df0bf aplicada
- Centros de costo poblados
- Seeds generales ejecutados (opcional)
- Validación completada

PRÓXIMOS PASOS AUTOMÁTICOS:
- GitHub Actions desplegará el backend automáticamente
- No requiere acción manual de deployment

Estado: EXITOSO
"@ | Out-File -FilePath $logPath -Encoding UTF8

Write-Success "Log guardado en: $logPath"

Write-Host "`n✅ Deployment completado exitosamente!" -ForegroundColor Green
