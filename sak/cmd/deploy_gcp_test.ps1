# Deploy Backend a GCP Cloud Run (TEST - rama test)
Write-Host "Desplegando backend a GCP Cloud Run [TEST]..." -ForegroundColor Yellow

Set-Location "$PSScriptRoot\..\backend"

# Deploy a Cloud Run - servicio separado para test
gcloud run deploy sak-backend-test `
    --source . `
    --region southamerica-east1 `
    --platform managed `
    --allow-unauthenticated `
    --min-instances 1 `
    --update-env-vars "CORS_ORIGINS=https://wcl.vercel.app" `
    --update-env-vars "CORS_ORIGINS_REGEX=https://.*-gustavo2866s-projects\.vercel\.app" `
    --update-env-vars "OPENAI_CHAT_REPLY_MODEL=gpt-4.1-mini"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backend TEST desplegado correctamente!" -ForegroundColor Green
} else {
    Write-Host "Error al desplegar backend TEST" -ForegroundColor Red
}

Set-Location "$PSScriptRoot"
