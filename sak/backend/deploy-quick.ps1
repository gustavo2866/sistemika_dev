# Deploy rápido a Cloud Run
# Este script hace deploy directo desde la rama actual sin esperar GitHub Actions

Write-Host "Deploy Rapido a Cloud Run - SAK Backend" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "app")) {
    Write-Host "Error: Ejecuta este script desde el directorio backend/" -ForegroundColor Red
    exit 1
}

# Variables
$PROJECT_ID = "sak-wcl"
$SERVICE_NAME = "sak-backend"
$REGION = "us-central1"

Write-Host ""
Write-Host "Proyecto: $PROJECT_ID" -ForegroundColor Green
Write-Host "Servicio: $SERVICE_NAME" -ForegroundColor Green
Write-Host "Region: $REGION" -ForegroundColor Green
Write-Host ""

# Confirmar deploy
$confirm = Read-Host "Continuar con el deploy? (s/n)"
if ($confirm -ne "s") {
    Write-Host "Deploy cancelado" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Iniciando deploy..." -ForegroundColor Cyan

# Hacer deploy
gcloud run deploy $SERVICE_NAME `
    --clear-base-image `
    --source . `
    --project $PROJECT_ID `
    --region $REGION `
    --platform managed `
    --allow-unauthenticated `
    --set-env-vars "ENV=production" `
    --set-env-vars "META_WEBHOOK_VERIFY_TOKEN=tu_token_aqui" `
    --set-secrets "DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,CLOUDINARY_CLOUD_NAME=CLOUDINARY_CLOUD_NAME:latest,CLOUDINARY_API_KEY=CLOUDINARY_API_KEY:latest,CLOUDINARY_API_SECRET=CLOUDINARY_API_SECRET:latest" `
    --max-instances 10 `
    --memory 512Mi `
    --cpu 1 `
    --timeout 300

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deploy exitoso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "URL del servicio:" -ForegroundColor Cyan
    gcloud run services describe $SERVICE_NAME --project $PROJECT_ID --region $REGION --format="value(status.url)"
    Write-Host ""
    Write-Host "Para ver logs:" -ForegroundColor Yellow
    Write-Host "   gcloud run services logs read $SERVICE_NAME --project $PROJECT_ID --region $REGION --limit 50" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "Error en el deploy" -ForegroundColor Red
    exit 1
}
