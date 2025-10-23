# Migraciones Alembic en Produccion
Write-Host "Aplicando migraciones en produccion (Neon)..." -ForegroundColor Cyan

Set-Location ..\backend

# Obtener el DATABASE_URL de GCP Secret Manager
Write-Host "Obteniendo DATABASE_URL de GCP Secret Manager..." -ForegroundColor Yellow
$DATABASE_URL = gcloud secrets versions access latest --secret="DATABASE_URL" --project="sak-wcl"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al obtener DATABASE_URL de Secret Manager" -ForegroundColor Red
    Set-Location ..\cmd
    exit 1
}

# Aplicar migraciones con el DATABASE_URL de producción
$env:DATABASE_URL = $DATABASE_URL
alembic upgrade head

if ($LASTEXITCODE -eq 0) {
    Write-Host "Migraciones aplicadas correctamente en Neon!" -ForegroundColor Green
} else {
    Write-Host "Error al aplicar migraciones" -ForegroundColor Red
}

# Limpiar variable de entorno
Remove-Item Env:\DATABASE_URL

Set-Location ..\cmd
