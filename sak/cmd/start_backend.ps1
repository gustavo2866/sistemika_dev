# Script para iniciar el backend de manera limpia
# Mata todos los procesos Python anteriores y reinicia uvicorn

Write-Host "🧹 Limpiando procesos Python anteriores..." -ForegroundColor Yellow

# Matar todos los procesos Python
Get-Process python -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  ❌ Deteniendo proceso Python (PID: $($_.Id))" -ForegroundColor Red
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Esperar un momento para asegurar que los procesos se han detenido
Start-Sleep -Seconds 1

# Verificar que no quedan procesos Python
$remainingProcesses = Get-Process python -ErrorAction SilentlyContinue
if ($remainingProcesses) {
    Write-Host "⚠️  Advertencia: Aún quedan procesos Python ejecutándose" -ForegroundColor Yellow
} else {
    Write-Host "✅ Todos los procesos Python han sido detenidos" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Iniciando backend en modo limpio..." -ForegroundColor Cyan
Write-Host "📁 Directorio: backend/" -ForegroundColor Gray
Write-Host "🌐 URL: http://localhost:8000" -ForegroundColor Gray
Write-Host "📖 Docs: http://localhost:8000/docs" -ForegroundColor Gray
Write-Host ""

# Cambiar al directorio backend
Set-Location "$PSScriptRoot\..\backend"

# Iniciar uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
