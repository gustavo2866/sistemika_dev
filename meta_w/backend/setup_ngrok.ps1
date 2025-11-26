# Instrucciones para configurar ngrok

Write-Host "=== CONFIGURACIÓN DE NGROK ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "ngrok instalado correctamente en C:\ngrok" -ForegroundColor Green
Write-Host ""
Write-Host "PASOS SIGUIENTES:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Ve a: https://dashboard.ngrok.com/signup" -ForegroundColor White
Write-Host "   - Regístrate o inicia sesión (gratis)"
Write-Host ""
Write-Host "2. Copia tu Authtoken desde: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor White
Write-Host ""
Write-Host "3. Ejecuta este comando con tu token:" -ForegroundColor White
Write-Host "   ngrok config add-authtoken TU_TOKEN_AQUI" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Luego ejecuta:" -ForegroundColor White
Write-Host "   ngrok http 8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Esto expondrá tu backend en una URL pública como: https://abc123.ngrok-free.app" -ForegroundColor Green
Write-Host ""
Write-Host "=== CONFIGURAR EN META ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Una vez que tengas la URL de ngrok:" -ForegroundColor White
Write-Host "1. Ve a: https://developers.facebook.com/apps" 
Write-Host "2. Tu app > WhatsApp > Configuration > Webhook"
Write-Host "3. Callback URL: https://TU_URL_NGROK/api/v1/webhooks/meta/whatsapp/?empresa_id=692d787d-06c4-432e-a94e-cf0686e593eb"
Write-Host "4. Verify Token: meta_webhook_verify_2025"
Write-Host "5. Click Verify and Save"
Write-Host "6. Subscribir a: messages, message_status"
Write-Host ""
Write-Host "Presiona ENTER para abrir el dashboard de ngrok..."
Read-Host
Start-Process "https://dashboard.ngrok.com/get-started/your-authtoken"
