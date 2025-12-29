# =========================================
# Regenerar credenciales GCP
# =========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "REGENERAR CREDENCIALES GCP" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Las credenciales actuales tienen firma JWT invalida." -ForegroundColor Yellow
Write-Host "Necesitas generar una nueva clave desde Google Cloud Console." -ForegroundColor Yellow
Write-Host ""

Write-Host "PASOS:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Ve a Google Cloud Console - Service Accounts:" -ForegroundColor White
Write-Host "   https://console.cloud.google.com/iam-admin/serviceaccounts?project=sak-wcl" -ForegroundColor Yellow
Write-Host ""

Write-Host "2. Busca la cuenta de servicio:" -ForegroundColor White
Write-Host "   sak-wcl-service@sak-wcl.iam.gserviceaccount.com" -ForegroundColor Yellow
Write-Host ""

Write-Host "3. Click en los tres puntos (Actions) -> Manage keys" -ForegroundColor White
Write-Host ""

Write-Host "4. Click en 'ADD KEY' -> 'Create new key'" -ForegroundColor White
Write-Host ""

Write-Host "5. Selecciona tipo 'JSON' y click en 'CREATE'" -ForegroundColor White
Write-Host ""

Write-Host "6. Se descargara un archivo JSON. Guardalo como:" -ForegroundColor White
Write-Host "   C:\Users\gpalmieri\source\sistemika\sak\backend\gcp-credentials.json" -ForegroundColor Yellow
Write-Host ""

Write-Host "7. (OPCIONAL) Elimina la clave antigua desde la consola" -ForegroundColor White
Write-Host "   Key ID: d1a44049ff8852a5af65ffdf5f7e8547a05ccbf6" -ForegroundColor DarkGray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DESPUES DE DESCARGAR LA NUEVA CLAVE" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Ejecuta este script para actualizar GitHub:" -ForegroundColor White
Write-Host "   .\setup-github-secret-clean.ps1" -ForegroundColor Yellow
Write-Host ""

Write-Host "2. Haz push a master para triggear el deploy:" -ForegroundColor White
Write-Host "   git push origin master" -ForegroundColor Yellow
Write-Host ""

Write-Host "Deseas abrir Google Cloud Console ahora? (s/n)" -ForegroundColor Cyan
$open = Read-Host

if ($open -eq "s" -or $open -eq "S") {
    Start-Process "https://console.cloud.google.com/iam-admin/serviceaccounts?project=sak-wcl"
    Write-Host ""
    Write-Host "Navegador abierto. Sigue los pasos arriba." -ForegroundColor Green
}

Write-Host ""
Write-Host "Presiona Enter cuando hayas descargado la nueva clave..." -ForegroundColor Yellow
Read-Host

# Verificar si existe el nuevo archivo
if (Test-Path "gcp-credentials.json") {
    Write-Host ""
    Write-Host "Archivo gcp-credentials.json encontrado!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Deseas actualizar el secret en GitHub ahora? (s/n)" -ForegroundColor Cyan
    $update = Read-Host
    
    if ($update -eq "s" -or $update -eq "S") {
        Write-Host ""
        Write-Host "Ejecutando setup-github-secret-clean.ps1..." -ForegroundColor Cyan
        & ".\setup-github-secret-clean.ps1"
    } else {
        Write-Host ""
        Write-Host "Recuerda ejecutar:" -ForegroundColor Yellow
        Write-Host ".\setup-github-secret-clean.ps1" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "No se encuentra gcp-credentials.json" -ForegroundColor Red
    Write-Host "Asegurate de guardar la nueva clave en:" -ForegroundColor Yellow
    Write-Host "C:\Users\gpalmieri\source\sistemika\sak\backend\gcp-credentials.json" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LISTO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
