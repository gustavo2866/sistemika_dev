# =========================================
# Quick Deploy - Versión Rápida
# =========================================
# Uso: .\quick-deploy.ps1 "mensaje del commit"

param(
    [Parameter(Mandatory=$false)]
    [string]$Message = "Update backend"
)

Write-Host "🚀 Quick Deploy..." -ForegroundColor Cyan

# Verificar branch
$branch = git branch --show-current
if ($branch -ne "gcp") {
    Write-Host "❌ Debes estar en branch 'gcp'" -ForegroundColor Red
    exit 1
}

# Git workflow (simplificado - GitHub Actions sincroniza master)
git add .
git commit -m $Message
git push origin gcp

Write-Host "✅ Push completado! GitHub Actions sincronizará master automáticamente" -ForegroundColor Green
Write-Host "ℹ️  Verifica en: https://github.com/gustavo2866/sistemika_dev/actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Listo! Ahora ejecuta en Cloud Shell:" -ForegroundColor Green
Write-Host "   cd ~/sistemika_dev/sak && git pull origin gcp" -ForegroundColor Yellow
Write-Host "   Luego el comando de gcloud run deploy" -ForegroundColor Yellow
