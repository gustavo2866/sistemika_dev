# =========================================
# Script: set_prod.ps1
# Configura entorno PRODUCCION (GCP/Neon)
# =========================================
# Uso: .\set_prod.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURAR ENTORNO PRODUCCION (GCP)" -ForegroundColor Yellow
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
    
    # Comentar línea local
    $content = $content -replace '^(DATABASE_URL=postgresql\+psycopg://sak_user:.*@localhost:5432/sak)', '# $1'
    
    # Descomentar línea de Neon (pooler)
    $content = $content -replace '^# (DATABASE_URL=postgresql\+psycopg://neondb_owner:.*-pooler\..*)', '$1'
    
    # Guardar cambios
    $content | Set-Content $backendEnv -NoNewline
    
    Write-Host "   Base de datos: Neon PostgreSQL (pooler)" -ForegroundColor Green
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
        if ($line -match '^NEXT_PUBLIC_API_URL=http://localhost:8000') {
            # Comentar línea local
            $newLines += "# $line"
        }
        elseif ($line -match '^# NEXT_PUBLIC_API_URL=https://sak-backend') {
            # Descomentar línea de GCP
            $newLines += $line -replace '^# ', ''
        }
        else {
            $newLines += $line
        }
    }
    
    # Guardar cambios
    $newLines | Set-Content $frontendEnv
    
    Write-Host "   API Backend: GCP Cloud Run" -ForegroundColor Green
} else {
    Write-Host "   Archivo frontend/.env.local no encontrado" -ForegroundColor Red
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
Write-Host "  Base de datos: Neon PostgreSQL" -ForegroundColor Yellow
Write-Host "  API: GCP Cloud Run" -ForegroundColor Yellow
Write-Host ""
Write-Host "Frontend configurado:" -ForegroundColor White
Write-Host "  API: https://sak-backend-94464199991.us-central1.run.app" -ForegroundColor Yellow
Write-Host ""
Write-Host "ADVERTENCIA:" -ForegroundColor Red
Write-Host "  Esta configuracion apunta a PRODUCCION" -ForegroundColor Yellow
Write-Host "  Asegurate de que quieres trabajar contra la BD de produccion" -ForegroundColor Yellow
Write-Host ""
Write-Host "Para volver a desarrollo local:" -ForegroundColor Cyan
Write-Host "  .\set_dev.ps1" -ForegroundColor White
Write-Host ""
