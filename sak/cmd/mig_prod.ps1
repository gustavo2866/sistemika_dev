# Migraciones Alembic en Produccion
Write-Host "Aplicando migraciones en produccion..." -ForegroundColor Cyan

Set-Location ..\backend

alembic upgrade head

if ($LASTEXITCODE -eq 0) {
    Write-Host "Migraciones aplicadas correctamente!" -ForegroundColor Green
} else {
    Write-Host "Error al aplicar migraciones" -ForegroundColor Red
}

Set-Location ..\cmd
