# Script simple para iniciar Backend y Frontend# Script simple para iniciar Backend y Frontend

# Abre dos ventanas separadas de PowerShell (recomendado)# Abre dos ventanas separadas de PowerShell



Write-Host "Iniciando Backend y Frontend en ventanas separadas..." -ForegroundColor GreenWrite-Host "Iniciando Backend y Frontend en ventanas separadas..." -ForegroundColor Green



# Obtener la ruta base del proyecto# Obtener la ruta base del proyecto

$projectRoot = Split-Path -Parent $PSScriptRoot$projectRoot = Split-Path -Parent $PSScriptRoot



# Iniciar Backend en nueva ventana# Iniciar Backend en nueva ventana

Write-Host "Abriendo Backend (Puerto 8000)..." -ForegroundColor BlueWrite-Host "Abriendo Backend (Puerto 8000)..." -ForegroundColor Blue

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\backend'; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\backend'; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"



# Esperar un momento# Esperar un momento

Start-Sleep -Seconds 2Start-Sleep -Seconds 2



# Iniciar Frontend en nueva ventana  # Iniciar Frontend en nueva ventana  

Write-Host "Abriendo Frontend (Puerto 3000)..." -ForegroundColor MagentaWrite-Host "Abriendo Frontend (Puerto 3000)..." -ForegroundColor Magenta

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\frontend'; npm run dev"Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\frontend'; npm run dev"



Write-Host "`nServicios iniciados en ventanas separadas:" -ForegroundColor GreenWrite-Host "`nServicios iniciados en ventanas separadas:" -ForegroundColor Green

Write-Host "   Backend:  http://localhost:8000" -ForegroundColor BlueWrite-Host "   Backend:  http://localhost:8000" -ForegroundColor Blue

Write-Host "   Frontend: http://localhost:3000" -ForegroundColor MagentaWrite-Host "   Frontend: http://localhost:3000" -ForegroundColor Magenta

Write-Host "   API Docs: http://localhost:8000/docs" -ForegroundColor BlueWrite-Host "   Docs API: http://localhost:8000/docs" -ForegroundColor Blue

Write-Host "`nCierra las ventanas individualmente para detener cada servicio" -ForegroundColor YellowWrite-Host "`nCierra las ventanas individualmente para detener cada servicio" -ForegroundColor Yellow