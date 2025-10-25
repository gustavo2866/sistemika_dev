# Script para iniciar Backend y Frontend
# Ejecuta ambos servicios en paralelo

Write-Host "Iniciando Backend y Frontend..." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan

# Obtener la ruta base del proyecto
$projectRoot = Split-Path -Parent $PSScriptRoot

# Función para detener servicios
function Stop-Services {
    Write-Host "`nDeteniendo servicios..." -ForegroundColor Yellow
    
    # Detener Node.js
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # Detener Python
    Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*uvicorn*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Write-Host "Servicios detenidos" -ForegroundColor Green
    exit 0
}

try {
    # Iniciar Backend
    Write-Host "Iniciando Backend (Puerto 8000)..." -ForegroundColor Blue
    $backendJob = Start-Job -ScriptBlock {
        param($projectRoot)
        Set-Location "$projectRoot\backend"
        python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    } -ArgumentList $projectRoot
    
    Start-Sleep -Seconds 3
    
    # Iniciar Frontend
    Write-Host "Iniciando Frontend (Puerto 3000)..." -ForegroundColor Magenta
    $frontendJob = Start-Job -ScriptBlock {
        param($projectRoot)
        Set-Location "$projectRoot\frontend"
        npm run dev
    } -ArgumentList $projectRoot
    
    Start-Sleep -Seconds 5
    
    Write-Host "`nServicios iniciados:" -ForegroundColor Green
    Write-Host "   Backend:  http://localhost:8000" -ForegroundColor Blue
    Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Magenta
    Write-Host "   API Docs: http://localhost:8000/docs" -ForegroundColor Blue
    Write-Host "`nPresiona Ctrl+C para detener ambos servicios" -ForegroundColor Yellow
    Write-Host "===============================================" -ForegroundColor Cyan
    
    # Loop de monitoreo
    while ($backendJob.State -eq "Running" -or $frontendJob.State -eq "Running") {
        # Recibir output del backend
        $backendOutput = Receive-Job -Job $backendJob -ErrorAction SilentlyContinue
        if ($backendOutput) {
            $backendOutput | ForEach-Object { Write-Host "[BACKEND] $_" -ForegroundColor Blue }
        }
        
        # Recibir output del frontend
        $frontendOutput = Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue
        if ($frontendOutput) {
            $frontendOutput | ForEach-Object { Write-Host "[FRONTEND] $_" -ForegroundColor Magenta }
        }
        
        # Verificar errores
        if ($backendJob.State -eq "Failed") {
            Write-Host "Backend fallo" -ForegroundColor Red
            Receive-Job -Job $backendJob
            break
        }
        
        if ($frontendJob.State -eq "Failed") {
            Write-Host "Frontend fallo" -ForegroundColor Red
            Receive-Job -Job $frontendJob
            break
        }
        
        Start-Sleep -Seconds 1
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    # Limpieza
    if ($backendJob) { 
        Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $backendJob -ErrorAction SilentlyContinue
    }
    if ($frontendJob) { 
        Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $frontendJob -ErrorAction SilentlyContinue
    }
    
    Stop-Services
}
