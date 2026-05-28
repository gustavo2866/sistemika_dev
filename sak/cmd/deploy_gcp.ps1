# Deploy Backend a GCP Cloud Run
Write-Host "Desplegando backend a GCP Cloud Run..." -ForegroundColor Cyan

Set-Location ..\backend

# Deploy a Cloud Run
gcloud run deploy sak-backend `
    --source . `
    --region southamerica-east1 `
    --platform managed `
    --allow-unauthenticated `
    --update-env-vars "CORS_ORIGINS=https://wcl.vercel.app" `
    --update-env-vars "CORS_ORIGINS_REGEX=https://.*-gustavo2866s-projects\.vercel\.app"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backend desplegado correctamente!" -ForegroundColor Green
} else {
    Write-Host "Error al desplegar backend" -ForegroundColor Red
}

Set-Location ..\cmd
