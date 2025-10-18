# Script para reiniciar el backend
# Detiene procesos existentes y reinicia de manera limpia

Write-Host "🔄 Reiniciando backend..." -ForegroundColor Cyan
Write-Host ""

# Ejecutar script de detención
& "$PSScriptRoot\stop_backend.ps1"

Write-Host ""

# Esperar un momento
Start-Sleep -Seconds 1

# Ejecutar script de inicio
& "$PSScriptRoot\start_backend.ps1"
