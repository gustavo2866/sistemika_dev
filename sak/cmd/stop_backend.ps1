# Script para detener el backend
# Mata todos los procesos Python

Write-Host "🛑 Deteniendo backend..." -ForegroundColor Red

# Matar todos los procesos Python
$processes = Get-Process python -ErrorAction SilentlyContinue

if ($processes) {
    $processes | ForEach-Object {
        Write-Host "  ❌ Deteniendo proceso Python (PID: $($_.Id))" -ForegroundColor Yellow
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "✅ Backend detenido correctamente" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No hay procesos Python ejecutándose" -ForegroundColor Cyan
}
