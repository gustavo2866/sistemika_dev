# Sincronizar Alembic con el estado actual de la BD
Write-Host "Sincronizando Alembic con base de datos de produccion..." -ForegroundColor Cyan

Set-Location ..\backend

# Paso 1: Crear una nueva migracion que capture TODAS las tablas actuales
Write-Host "`n1. Generando migracion de sincronizacion..." -ForegroundColor Yellow
alembic revision --autogenerate -m "sync_with_manual_migrations"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al generar migracion" -ForegroundColor Red
    Set-Location ..\cmd
    exit 1
}

# Paso 2: Marcar esta migracion como ya aplicada (stamp) sin ejecutarla
Write-Host "`n2. Marcando migracion como aplicada (stamp)..." -ForegroundColor Yellow
alembic stamp head

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al marcar migracion" -ForegroundColor Red
    Set-Location ..\cmd
    exit 1
}

Write-Host "`nAlembic sincronizado correctamente!" -ForegroundColor Green
Write-Host "De ahora en mas, usa solo Alembic para migraciones." -ForegroundColor Cyan

Set-Location ..\cmd
