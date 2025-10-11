# Script para limpiar archivos temporales antes del deploy

$ErrorActionPreference = "Stop"

Write-Host "Limpiando archivos temporales..." -ForegroundColor Cyan

# Limpiar __pycache__
Write-Host "`nEliminando __pycache__..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter "__pycache__" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Recurse -Filter "*.pyc" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter "*.pyo" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter "*.pyd" -File -ErrorAction SilentlyContinue | Remove-Item -Force

# Limpiar archivos de base de datos local
Write-Host "Limpiando archivos de BD local..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter "*.db" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter "*.sqlite" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter "*.sqlite3" -File -ErrorAction SilentlyContinue | Remove-Item -Force

# Limpiar logs
Write-Host "Limpiando logs..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter "*.log" -File -ErrorAction SilentlyContinue | Remove-Item -Force

# Limpiar backups
Write-Host "Limpiando backups..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter "*.backup" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter "*~" -File -ErrorAction SilentlyContinue | Remove-Item -Force

# Limpiar archivos de entorno y configuracion sensible
Write-Host "Limpiando archivos sensibles..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter ".env*" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter "*.key" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter "*.pem" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter "secrets.json" -File -ErrorAction SilentlyContinue | Remove-Item -Force

# Limpiar carpetas de entornos virtuales
Write-Host "Limpiando entornos virtuales..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter "venv" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Recurse -Filter "env" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Recurse -Filter ".venv" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force

# Limpiar archivos de IDE
Write-Host "Limpiando archivos de IDE..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter ".vscode" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Recurse -Filter ".idea" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Recurse -Filter "*.swp" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter "*.swo" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter ".DS_Store" -File -ErrorAction SilentlyContinue | Remove-Item -Force

# Limpiar archivos de testing
Write-Host "Limpiando archivos de testing..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter ".pytest_cache" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Recurse -Filter ".coverage" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path . -Recurse -Filter "htmlcov" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Recurse -Filter ".tox" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force

# Limpiar build y distribucion
Write-Host "Limpiando archivos de build..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter "dist" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Recurse -Filter "build" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Recurse -Filter "*.egg-info" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force

# Limpiar node_modules si existe
Write-Host "Limpiando node_modules..." -ForegroundColor Yellow
Get-ChildItem -Path . -Recurse -Filter "node_modules" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force

Write-Host "`nLimpieza completada!" -ForegroundColor Green
Write-Host "Tu backend esta listo para deploy seguro en la nube" -ForegroundColor Cyan
