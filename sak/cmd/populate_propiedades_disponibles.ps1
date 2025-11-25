# Script PowerShell para ejecutar populate_propiedades_disponibles.py

Write-Host "Ejecutando script de poblacion de propiedades disponibles..." -ForegroundColor Cyan

$env:PYTHONPATH = "C:\Users\gpalmieri\source\sistemika\sak\backend"
Set-Location "C:\Users\gpalmieri\source\sistemika\sak\backend"

python scripts\populate_propiedades_disponibles.py

if ($LASTEXITCODE -eq 0) {
    Write-Host "Script ejecutado exitosamente" -ForegroundColor Green
} else {
    Write-Host "Error al ejecutar el script" -ForegroundColor Red
}

