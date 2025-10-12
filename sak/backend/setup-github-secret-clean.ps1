# =========================================
# Configurar GCP_SA_KEY en GitHub
# =========================================
# Este script te ayuda a configurar el secreto
# GCP_SA_KEY en tu repositorio de GitHub

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURAR GCP_SA_KEY EN GITHUB" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que existe gcp-credentials.json
$credentialsFile = "gcp-credentials.json"
if (-not (Test-Path $credentialsFile)) {
    Write-Host "Error: No se encuentra $credentialsFile" -ForegroundColor Red
    Write-Host "   Asegurate de estar en el directorio backend/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Archivo $credentialsFile encontrado" -ForegroundColor Green
Write-Host ""

# 2. Leer el archivo
Write-Host "Leyendo el archivo..." -ForegroundColor Cyan
$fileContent = Get-Content -Path $credentialsFile -Raw

# 3. Copiar al portapapeles
$fileContent | Set-Clipboard

Write-Host "Contenido copiado al portapapeles" -ForegroundColor Green
Write-Host ""

# 4. Mostrar instrucciones
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INSTRUCCIONES" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Ve a tu repositorio en GitHub:" -ForegroundColor Cyan
Write-Host "   https://github.com/gustavo2866/sistemika_dev/settings/secrets/actions" -ForegroundColor Yellow
Write-Host ""

Write-Host "2. Click en 'New repository secret'" -ForegroundColor Cyan
Write-Host ""

Write-Host "3. Configurar el secreto:" -ForegroundColor Cyan
Write-Host "   Name:  GCP_SA_KEY" -ForegroundColor White
Write-Host "   Value: Presiona Ctrl+V para pegar" -ForegroundColor White
Write-Host ""

Write-Host "4. Click en 'Add secret'" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LISTO PARA PEGAR" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "El valor esta en tu portapapeles." -ForegroundColor White
Write-Host "Presiona Ctrl+V en el campo 'Value' de GitHub." -ForegroundColor White
Write-Host ""

# 5. Mostrar preview (primeros caracteres)
$preview = $fileContent.Substring(0, [Math]::Min(100, $fileContent.Length))
Write-Host "Preview del valor:" -ForegroundColor Cyan
Write-Host $preview -ForegroundColor DarkGray
Write-Host "..." -ForegroundColor DarkGray
Write-Host ""

Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   - El nombre debe ser exactamente: GCP_SA_KEY" -ForegroundColor White
Write-Host "   - Pega TODO el contenido del portapapeles" -ForegroundColor White
Write-Host "   - NO compartas este secreto publicamente" -ForegroundColor White
Write-Host ""

# 6. Abrir el navegador
Write-Host "Deseas abrir GitHub en el navegador? (s/n)" -ForegroundColor Yellow
$openBrowser = Read-Host
if ($openBrowser -eq "s" -or $openBrowser -eq "S") {
    Start-Process "https://github.com/gustavo2866/sistemika_dev/settings/secrets/actions"
    Write-Host ""
    Write-Host "Navegador abierto. Configura el secreto alli." -ForegroundColor Green
}

Write-Host ""
Write-Host "Presiona Enter despues de agregar el secreto en GitHub..." -ForegroundColor Yellow
Read-Host

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURACION COMPLETA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ahora cuando hagas push a 'gcp':" -ForegroundColor Cyan
Write-Host "1. Se sincronizara automaticamente a 'master'" -ForegroundColor White
Write-Host "2. Se desplegara automaticamente a GCP Cloud Run" -ForegroundColor White
Write-Host ""
