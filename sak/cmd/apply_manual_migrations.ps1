# Aplicar migracion 018 (proyectos) en produccion
Write-Host "Aplicando migracion 018 - Tabla proyectos..." -ForegroundColor Cyan

Set-Location ..\backend

python migrations/018_add_proyectos_pg.py

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nMigracion aplicada correctamente!" -ForegroundColor Green
} else {
    Write-Host "`nError al aplicar migracion" -ForegroundColor Red
    Set-Location ..\cmd
    exit 1
}

Set-Location ..\cmd
