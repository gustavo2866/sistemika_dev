# =========================================
# Configurar GCP_SA_KEY en GitHub
# =========================================
# Este script te ayuda a configurar el secreto
# GCP_SA_KEY en tu repositorio de GitHub

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔐 CONFIGURAR GCP_SA_KEY EN GITHUB" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que existe gcp-credentials.json
$credentialsFile = "gcp-credentials.json"
if (-not (Test-Path $credentialsFile)) {
    Write-Host "❌ Error: No se encuentra $credentialsFile" -ForegroundColor Red
    Write-Host "   Asegúrate de estar en el directorio backend/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Archivo $credentialsFile encontrado" -ForegroundColor Green
Write-Host ""

# 2. Leer y codificar el archivo
Write-Host "🔹 Leyendo y codificando el archivo..." -ForegroundColor Cyan
$fileContent = Get-Content -Path $credentialsFile -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($fileContent)
$base64 = [Convert]::ToBase64String($bytes)

# 3. Copiar al portapapeles
$base64 | Set-Clipboard

Write-Host "✅ Contenido codificado en base64 y copiado al portapapeles" -ForegroundColor Green
Write-Host ""

# 4. Mostrar instrucciones
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📋 INSTRUCCIONES" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣  Ve a tu repositorio en GitHub:" -ForegroundColor Cyan
Write-Host "   https://github.com/gustavo2866/sistemika_dev" -ForegroundColor Yellow
Write-Host ""

Write-Host "2️⃣  Click en 'Settings' (esquina superior derecha)" -ForegroundColor Cyan
Write-Host ""

Write-Host "3️⃣  En el menú lateral:" -ForegroundColor Cyan
Write-Host "   → Secrets and variables → Actions" -ForegroundColor White
Write-Host ""

Write-Host "4️⃣  Click en 'New repository secret'" -ForegroundColor Cyan
Write-Host ""

Write-Host "5️⃣  Configurar el secreto:" -ForegroundColor Cyan
Write-Host "   Name:  " -NoNewline -ForegroundColor White
Write-Host "GCP_SA_KEY" -ForegroundColor Yellow
Write-Host "   Value: " -NoNewline -ForegroundColor White
Write-Host "Ctrl+V para pegar desde el portapapeles" -ForegroundColor Green
Write-Host ""

Write-Host "6️⃣  Click en 'Add secret'" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ LISTO PARA PEGAR" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "El valor codificado está en tu portapapeles." -ForegroundColor White
Write-Host "Presiona Ctrl+V en el campo 'Value' de GitHub." -ForegroundColor White
Write-Host ""

# 5. Mostrar preview (primeros y últimos caracteres)
$preview = $base64.Substring(0, [Math]::Min(50, $base64.Length))
$previewEnd = $base64.Substring([Math]::Max(0, $base64.Length - 50))
Write-Host "🔍 Preview del valor (primeros 50 caracteres):" -ForegroundColor Cyan
Write-Host "   $preview..." -ForegroundColor DarkGray
Write-Host "   ...últimos 50: $previewEnd" -ForegroundColor DarkGray
Write-Host ""

Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   - El nombre debe ser exactamente: GCP_SA_KEY" -ForegroundColor White
Write-Host "   - Pega TODO el contenido del portapapeles" -ForegroundColor White
Write-Host "   - NO compartas este secreto públicamente" -ForegroundColor White
Write-Host ""

# 6. Esperar confirmación
Write-Host "Presiona Enter después de agregar el secreto en GitHub..." -ForegroundColor Yellow
Read-Host

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ CONFIGURACIÓN COMPLETA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ahora puedes ejecutar:" -ForegroundColor Cyan
Write-Host "   .\deploy-to-production.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "El workflow de GitHub Actions desplegara" -ForegroundColor White
Write-Host "automaticamente a GCP Cloud Run." -ForegroundColor White
Write-Host ""
