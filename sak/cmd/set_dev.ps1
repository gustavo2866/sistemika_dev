# =========================================
# Script: set_dev.ps1
# Configura entorno LOCAL para desarrollo
# =========================================
# Uso: .\set_dev.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURAR ENTORNO LOCAL (DEV)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# La raíz del proyecto es un nivel arriba de cmd/
$root = Split-Path $PSScriptRoot -Parent

# ============================================
# 1. CONFIGURAR BACKEND/.ENV
# ============================================
Write-Host "1. Configurando backend/.env..." -ForegroundColor Cyan

$backendEnv = Join-Path $root "backend\.env"

if (Test-Path $backendEnv) {
    $content = Get-Content $backendEnv -Raw
    
    # Comentar líneas de Neon
    $content = $content -replace '^(DATABASE_URL=postgresql\+psycopg://neondb_owner:.*)', '# $1'
    
    # Descomentar línea local
    $content = $content -replace '^# (DATABASE_URL=postgresql\+psycopg://sak_user:.*@localhost:5432/sak)', '$1'
    
    # Guardar cambios
    $content | Set-Content $backendEnv -NoNewline
    
    Write-Host "   Base de datos: localhost:5432/sak" -ForegroundColor Green
} else {
    Write-Host "   Archivo backend/.env no encontrado" -ForegroundColor Red
}

# ============================================
# 2. CONFIGURAR FRONTEND/.ENV.LOCAL
# ============================================
Write-Host "2. Configurando frontend/.env.local..." -ForegroundColor Cyan

$frontendEnv = Join-Path $root "frontend\.env.local"

if (Test-Path $frontendEnv) {
    $lines = Get-Content $frontendEnv
    $newLines = @()
    
    foreach ($line in $lines) {
        if ($line -match '^NEXT_PUBLIC_API_URL=https://sak-backend') {
            # Comentar línea de GCP
            $newLines += "# $line"
        }
        elseif ($line -match '^# NEXT_PUBLIC_API_URL=http://localhost:8000') {
            # Descomentar línea local
            $newLines += $line -replace '^# ', ''
        }
        else {
            $newLines += $line
        }
    }
    
    # Guardar cambios
    $newLines | Set-Content $frontendEnv
    
    Write-Host "   API Backend: http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "   Creando frontend/.env.local..." -ForegroundColor Yellow
    
    $newContent = @"
# Backend Local (desarrollo)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend GCP (produccion)
# NEXT_PUBLIC_API_URL=https://sak-backend-94464199991.us-central1.run.app
"@
    
    $newContent | Set-Content $frontendEnv
    Write-Host "   API Backend: http://localhost:8000" -ForegroundColor Green
}

# ============================================
# 3. RESUMEN
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURACION COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend configurado:" -ForegroundColor White
Write-Host "  Base de datos: localhost:5432/sak" -ForegroundColor Yellow
Write-Host "  Puerto: 8000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Frontend configurado:" -ForegroundColor White
Write-Host "  API: http://localhost:8000" -ForegroundColor Yellow
Write-Host "  Puerto: 3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Iniciar servidores:" -ForegroundColor Cyan
Write-Host "  Backend:  cd backend; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor White
Write-Host "  Frontend: cd frontend; npm run dev" -ForegroundColor White
Write-Host ""
