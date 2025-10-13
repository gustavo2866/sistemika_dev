# Deploy Backend a GCP Cloud Run
Write-Host "Desplegando backend a GCP Cloud Run..." -ForegroundColor Cyan

Set-Location ..\backend

# Deploy a Cloud Run
gcloud run deploy sak-backend `
    --source . `
    --region us-central1 `
    --platform managed `
    --allow-unauthenticated

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backend desplegado correctamente!" -ForegroundColor Green
} else {
    Write-Host "Error al desplegar backend" -ForegroundColor Red
}

Set-Location ..\cmd
