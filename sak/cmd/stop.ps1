# Script para detener todos los servicios del proyecto# Script para detener todos los servicios del proyecto



Write-Host "Deteniendo todos los servicios..." -ForegroundColor YellowWrite-Host "Deteniendo todos los servicios..." -ForegroundColor Yellow



# Detener procesos de Node.js (Frontend)# Detener procesos de Node.js (Frontend)

Write-Host "Deteniendo Frontend..." -ForegroundColor MagentaWrite-Host "Deteniendo Frontend..." -ForegroundColor Magenta

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { 

    $_.ProcessName -eq "node" -and (    $_.ProcessName -eq "node" -and (

        $_.CommandLine -like "*npm run dev*" -or         $_.CommandLine -like "*npm run dev*" -or 

        $_.CommandLine -like "*next dev*" -or        $_.CommandLine -like "*next dev*" -or

        $_.CommandLine -like "*frontend*"        $_.CommandLine -like "*frontend*"

    )    )

}}



if ($nodeProcesses) {if ($nodeProcesses) {

    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Host "   Frontend detenido" -ForegroundColor Green    Write-Host "   Frontend detenido" -ForegroundColor Green

} else {} else {

    Write-Host "   Frontend no estaba ejecutandose" -ForegroundColor Gray    Write-Host "   Frontend no estaba ejecutandose" -ForegroundColor Gray

}}



# Detener procesos de Python (Backend)# Detener procesos de Python (Backend)

Write-Host "Deteniendo Backend..." -ForegroundColor BlueWrite-Host "Deteniendo Backend..." -ForegroundColor Blue

$pythonProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $pythonProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { 

    $_.CommandLine -like "*uvicorn*" -or     $_.CommandLine -like "*uvicorn*" -or 

    $_.CommandLine -like "*app.main*" -or    $_.CommandLine -like "*app.main*" -or

    $_.CommandLine -like "*backend*"    $_.CommandLine -like "*backend*"

}}



if ($pythonProcesses) {if ($pythonProcesses) {

    $pythonProcesses | Stop-Process -Force -ErrorAction SilentlyContinue    $pythonProcesses | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Host "   Backend detenido" -ForegroundColor Green    Write-Host "   Backend detenido" -ForegroundColor Green

} else {} else {

    Write-Host "   Backend no estaba ejecutandose" -ForegroundColor Gray    Write-Host "   Backend no estaba ejecutandose" -ForegroundColor Gray

}}



# Verificar puertos# Verificar puertos

Write-Host "`nVerificando puertos..." -ForegroundColor CyanWrite-Host "`nVerificando puertos..." -ForegroundColor Cyan



$port3000 = netstat -ano | findstr ":3000"$port3000 = netstat -ano | findstr ":3000"

$port8000 = netstat -ano | findstr ":8000"$port8000 = netstat -ano | findstr ":8000"



if (-not $port3000) {if (-not $port3000) {

    Write-Host "   Puerto 3000 liberado (Frontend)" -ForegroundColor Green    Write-Host "   Puerto 3000 liberado (Frontend)" -ForegroundColor Green

} else {} else {

    Write-Host "   Puerto 3000 aun en uso" -ForegroundColor Yellow    Write-Host "   Puerto 3000 aun en uso" -ForegroundColor Yellow

}}



if (-not $port8000) {if (-not $port8000) {

    Write-Host "   Puerto 8000 liberado (Backend)" -ForegroundColor Green    Write-Host "   Puerto 8000 liberado (Backend)" -ForegroundColor Green

} else {} else {

    Write-Host "   Puerto 8000 aun en uso" -ForegroundColor Yellow    Write-Host "   Puerto 8000 aun en uso" -ForegroundColor Yellow

}}



Write-Host "`nProceso de detencion completado" -ForegroundColor GreenWrite-Host "`nProceso de detencion completado" -ForegroundColor Green