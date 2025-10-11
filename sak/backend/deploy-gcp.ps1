# =========================================
# Script de Deploy Automatizado a GCP
# =========================================
# Automatiza: commit → push → merge a master → deploy a Cloud Run

param(
    [Parameter(Mandatory=$true)]
    [string]$Message,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipMerge
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 DEPLOY AUTOMATIZADO A GCP" -ForegroundColor Yellow
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

# 2. Verificar cambios pendientes
$status = git status --porcelain
if (-not $status) {
    Write-Host "ℹ️  No hay cambios pendientes para commitear" -ForegroundColor Yellow
} else {
    Write-Host "📝 Cambios pendientes detectados" -ForegroundColor Cyan
    
    # 3. Add y Commit
    Write-Host "`n🔹 Paso 1: Agregando archivos..." -ForegroundColor Cyan
    git add .
    
    Write-Host "🔹 Paso 2: Commiteando cambios..." -ForegroundColor Cyan
    git commit -m $Message
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error en commit" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Commit exitoso" -ForegroundColor Green
}

# 4. Push a gcp
Write-Host "`n🔹 Paso 3: Pusheando a origin/gcp..." -ForegroundColor Cyan
git push origin gcp

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error en push" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Push exitoso" -ForegroundColor Green

# 5. Merge a master (opcional - GitHub Actions lo hace automáticamente)
if (-not $SkipMerge) {
    Write-Host "`n🔹 Paso 4: Mergeando a master (local)..." -ForegroundColor Cyan
    Write-Host "ℹ️  Nota: GitHub Actions también sincronizará master automáticamente" -ForegroundColor Yellow
    git checkout master
    git merge gcp -m "Merge gcp: $Message"
    git push origin master
    git checkout gcp
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error en merge a master" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Merge a master exitoso" -ForegroundColor Green
} else {
    Write-Host "`nℹ️  Saltando merge local a master" -ForegroundColor Yellow
    Write-Host "✅ GitHub Actions sincronizará master automáticamente" -ForegroundColor Green
}

# 6. Ejecutar tests (opcional)
if (-not $SkipTests) {
    Write-Host "`n🔹 Paso 5: Ejecutando tests..." -ForegroundColor Cyan
    python test_endpoints.py
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Tests fallaron, pero continuando..." -ForegroundColor Yellow
    } else {
        Write-Host "✅ Tests pasaron" -ForegroundColor Green
    }
} else {
    Write-Host "`nℹ️  Saltando tests (--SkipTests)" -ForegroundColor Yellow
}

# 7. Mostrar comando para Cloud Shell
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ CAMBIOS LISTOS PARA DEPLOY" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Ejecuta estos comandos en GCP Cloud Shell:" -ForegroundColor Yellow
Write-Host ""
Write-Host "cd ~/sistemika_dev/sak" -ForegroundColor White
Write-Host "git pull origin gcp" -ForegroundColor White
Write-Host ""
Write-Host "gcloud run deploy sak-backend \\" -ForegroundColor White
Write-Host "  --source ./backend \\" -ForegroundColor White
Write-Host "  --region us-central1 \\" -ForegroundColor White
Write-Host "  --project sak-wcl \\" -ForegroundColor White
Write-Host "  --service-account sak-wcl-service@sak-wcl.iam.gserviceaccount.com \\" -ForegroundColor White
Write-Host "  --allow-unauthenticated \\" -ForegroundColor White
Write-Host "  --set-secrets=`"DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest`" \\" -ForegroundColor White
Write-Host "  --set-env-vars=`"ENV=prod,CORS_ORIGINS=https://wcl-seven.vercel.app;http://localhost:3000,SQLALCHEMY_ECHO=0`"" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

# 8. Preguntar si quiere copiar el comando
Write-Host ""
$copy = Read-Host "¿Copiar comando de deploy al portapapeles? (s/n)"
if ($copy -eq "s" -or $copy -eq "S") {
    $deployCommand = @"
cd ~/sistemika_dev/sak
git pull origin gcp
gcloud run deploy sak-backend --source ./backend --region us-central1 --project sak-wcl --service-account sak-wcl-service@sak-wcl.iam.gserviceaccount.com --allow-unauthenticated --set-secrets="DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest" --set-env-vars="ENV=prod,CORS_ORIGINS=https://wcl-seven.vercel.app;http://localhost:3000,SQLALCHEMY_ECHO=0"
"@
    Set-Clipboard -Value $deployCommand
    Write-Host "✅ Comando copiado al portapapeles" -ForegroundColor Green
}

Write-Host ""
Write-Host "✨ ¡Proceso completado!" -ForegroundColor Green
