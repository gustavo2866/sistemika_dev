# =========================================
# Switch Frontend to GCP Backend
# =========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔄 CAMBIAR A BACKEND GCP" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$envContent = @"
# Backend GCP (Producción)
NEXT_PUBLIC_API_URL=https://sak-backend-94464199991.us-central1.run.app

# Backend Local (Desarrollo) - Descomenta para usar local
# NEXT_PUBLIC_API_URL=http://localhost:8000
"@

$envContent | Set-Content -Path ".env.local" -Encoding UTF8

Write-Host "✅ Configurado para Backend GCP" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configuración actual:" -ForegroundColor Cyan
Write-Host "   NEXT_PUBLIC_API_URL=https://sak-backend-94464199991.us-central1.run.app" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Importante:" -ForegroundColor Yellow
Write-Host "   Reinicia el servidor frontend:" -ForegroundColor White
Write-Host "      Presiona Ctrl+C en la terminal donde corre npm" -ForegroundColor DarkGray
Write-Host "      npm run dev" -ForegroundColor DarkGray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
