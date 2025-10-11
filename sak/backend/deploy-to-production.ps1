# =========================================
# Deploy Backend to Production
# =========================================
# Este script lleva los cambios de gcp a master
# y dispara el deploy automático a GCP Cloud Run

param(
    [Parameter(Mandatory=$false)]
    [string]$Message = "Deploy backend to production",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 DEPLOY BACKEND TO PRODUCTION" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que estamos en branch gcp
$currentBranch = git branch --show-current
if ($currentBranch -ne "gcp") {
    Write-Host "❌ Error: Debes estar en el branch 'gcp'" -ForegroundColor Red
    Write-Host "   Ejecuta: git checkout gcp" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Branch actual: gcp" -ForegroundColor Green

# 2. Verificar que no hay cambios sin commitear
$status = git status --porcelain
if ($status) {
    Write-Host "⚠️  Hay cambios sin commitear:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    $continue = Read-Host "¿Commitear cambios antes de continuar? (s/n)"
    if ($continue -eq "s" -or $continue -eq "S") {
        git add .
        git commit -m $Message
        git push origin gcp
        Write-Host "✅ Cambios commiteados y pusheados" -ForegroundColor Green
    } else {
        Write-Host "❌ Cancelado. Commitea los cambios primero." -ForegroundColor Red
        exit 1
    }
}

# 3. Ejecutar tests (opcional)
if (-not $SkipTests) {
    Write-Host "`n🔹 Ejecutando tests..." -ForegroundColor Cyan
    python test_endpoints.py
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Tests fallaron" -ForegroundColor Yellow
        $continue = Read-Host "¿Continuar con el deploy de todos modos? (s/n)"
        if ($continue -ne "s" -and $continue -ne "S") {
            Write-Host "❌ Deploy cancelado" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "✅ Tests pasaron" -ForegroundColor Green
    }
}

# 4. Confirmar deploy
Write-Host "`n⚠️  IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   Esto llevará los cambios a PRODUCCIÓN (master)" -ForegroundColor Yellow
Write-Host "   y desplegará automáticamente a GCP Cloud Run" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "¿Continuar con el deploy a producción? (s/n)"
if ($confirm -ne "s" -and $confirm -ne "S") {
    Write-Host "❌ Deploy cancelado" -ForegroundColor Red
    exit 1
}

# 5. Merge a master
Write-Host "`n🔹 Mergeando gcp → master..." -ForegroundColor Cyan
git checkout master
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al cambiar a master" -ForegroundColor Red
    exit 1
}

git pull origin master
git merge gcp -m "Production deploy: $Message"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error en merge. Resuelve los conflictos manualmente." -ForegroundColor Red
    git merge --abort
    git checkout gcp
    exit 1
}

# 6. Push a master (dispara GitHub Actions)
Write-Host "🔹 Pusheando a master..." -ForegroundColor Cyan
git push origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error en push" -ForegroundColor Red
    git checkout gcp
    exit 1
}

# 7. Volver a gcp
git checkout gcp

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ DEPLOY INICIADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 ¿Qué pasó?" -ForegroundColor Cyan
Write-Host "  1. ✅ Merge gcp → master completado" -ForegroundColor White
Write-Host "  2. ✅ Push a master ejecutado" -ForegroundColor White
Write-Host "  3. ⏳ GitHub Actions está desplegando a GCP..." -ForegroundColor White
Write-Host ""
Write-Host "🔍 Monitorea el progreso:" -ForegroundColor Cyan
Write-Host "   https://github.com/gustavo2866/sistemika_dev/actions" -ForegroundColor Yellow
Write-Host ""
Write-Host "🌐 URL del backend (en ~2-3 minutos):" -ForegroundColor Cyan
Write-Host "   https://sak-backend-94464199991.us-central1.run.app" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
