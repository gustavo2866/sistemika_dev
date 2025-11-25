# Script para poblar oportunidades en base de datos local de desarrollo
# Uso: .\cmd\populate_oportunidades_dev.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " POBLACIÓN DE OPORTUNIDADES CRM - DEV" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path ".\backend\scripts\populate_oportunidades_dev.py")) {
    Write-Host "❌ Error: Ejecuta este script desde el directorio raíz del proyecto" -ForegroundColor Red
    exit 1
}

# Cambiar al directorio backend
Set-Location .\backend

Write-Host "📂 Directorio: $(Get-Location)" -ForegroundColor Gray
Write-Host ""

# Verificar que existe el archivo de variables de entorno
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Advertencia: No se encontró archivo .env" -ForegroundColor Yellow
    Write-Host "   Usando configuración por defecto: postgresql://postgres:postgres@localhost:5432/crm_dev" -ForegroundColor Gray
}

# Ejecutar el script de Python
Write-Host "🚀 Ejecutando script de población..." -ForegroundColor Green
Write-Host ""

python scripts\populate_oportunidades_dev.py

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " ✅ COMPLETADO EXITOSAMENTE" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host " ❌ ERROR EN LA EJECUCIÓN" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Volver al directorio raíz
Set-Location ..
