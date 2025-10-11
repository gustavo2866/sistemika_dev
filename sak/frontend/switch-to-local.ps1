# =========================================
# Switch Frontend to Local Backend
# =========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔄 CAMBIAR A BACKEND LOCAL" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$envContent = @"
# Backend Local (Desarrollo)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend GCP (Producción) - Descomenta para usar GCP
# NEXT_PUBLIC_API_URL=https://sak-backend-94464199991.us-central1.run.app
"@

$envContent | Set-Content -Path ".env.local" -Encoding UTF8

Write-Host "✅ Configurado para Backend Local" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configuración actual:" -ForegroundColor Cyan
Write-Host "   NEXT_PUBLIC_API_URL=http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Importante:" -ForegroundColor Yellow
Write-Host "   1. Asegúrate de que el backend esté corriendo:" -ForegroundColor White
Write-Host "      cd ../backend" -ForegroundColor DarkGray
Write-Host "      uvicorn app.main:app --reload" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   2. Reinicia el servidor frontend:" -ForegroundColor White
Write-Host "      Presiona Ctrl+C en la terminal donde corre npm" -ForegroundColor DarkGray
Write-Host "      npm run dev" -ForegroundColor DarkGray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
