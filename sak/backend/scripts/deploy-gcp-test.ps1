param(
    [string]$ProjectId = "sak-wcl",
    [string]$Region = "southamerica-east1",
    [string]$ServiceName = "sak-backend-test",
    [string]$ServiceAccount = "sak-wcl-service@sak-wcl.iam.gserviceaccount.com",
    [string]$RepositoryUrl = "https://github.com/gustavo2866/sistemika_dev.git",
    [string]$Branch = "test",
    [string]$ImageTag = ""
)

$ErrorActionPreference = "Stop"

$WorkDir = Join-Path ([System.IO.Path]::GetTempPath()) ("sak-deploy-test-" + (Get-Date -Format "yyyyMMddHHmmss"))
$CheckoutDir = Join-Path $WorkDir "repo"

function Invoke-Step {
    param(
        [string]$Title,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "==> $Title"
    & $Command
}

Invoke-Step "Validando gcloud" {
    & gcloud.cmd --version | Select-Object -First 1
    $Account = & gcloud.cmd auth list --filter=status:ACTIVE --format="value(account)"
    if (-not $Account) {
        throw "No hay una cuenta activa en gcloud. Ejecuta: gcloud auth login"
    }
    Write-Host "Cuenta activa: $Account"
}

Invoke-Step "Clonando fuente desde GitHub" {
    & git clone --branch $Branch --depth 1 $RepositoryUrl $CheckoutDir
}

$BackendDir = Join-Path $CheckoutDir "sak\backend"
if (-not (Test-Path (Join-Path $BackendDir "Dockerfile"))) {
    throw "No encontre Dockerfile en $BackendDir"
}

$CommitSha = (& git -C $CheckoutDir rev-parse --short HEAD).Trim()
if (-not $ImageTag) {
    $ImageTag = "$Branch-$CommitSha-" + (Get-Date -Format "yyyyMMddHHmmss")
}
$Image = "$Region-docker.pkg.dev/$ProjectId/cloud-run-source-deploy/${ServiceName}:$ImageTag"

Write-Host ""
Write-Host "Fuente: $RepositoryUrl"
Write-Host "Branch: $Branch"
Write-Host "Commit: $CommitSha"
Write-Host "Backend: $BackendDir"
Write-Host "Imagen: $Image"

Invoke-Step "Construyendo imagen en Cloud Build" {
    & gcloud.cmd builds submit $BackendDir `
        --tag $Image `
        --region=$Region `
        --project=$ProjectId
}

Invoke-Step "Desplegando imagen en Cloud Run test" {
    & gcloud.cmd run deploy $ServiceName `
        --image $Image `
        --region $Region `
        --project $ProjectId `
        --service-account $ServiceAccount `
        --allow-unauthenticated `
        --cpu=1 `
        --memory=1Gi `
        --concurrency=80 `
        --timeout=3600 `
        --min-instances=1 `
        --max-instances=10 `
        --set-secrets="DATABASE_URL=DATABASE_URL_TEST:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest" `
        --set-env-vars="ENV=test,OPENAI_CHAT_REPLY_MODEL=gpt-4.1-mini,CORS_ORIGINS=https://wcl.vercel.app;http://localhost:3000,CORS_ORIGINS_REGEX=https://.*-gustavo2866s-projects\.vercel\.app,SQLALCHEMY_ECHO=0,GCS_PROJECT_ID=$ProjectId,GCS_BUCKET_NAME=sak-wcl-bucket,GCS_INVOICE_FOLDER=facturas"
}

Invoke-Step "URL del servicio" {
    & gcloud.cmd run services describe $ServiceName `
        --region $Region `
        --project $ProjectId `
        --format="value(status.url)"
}

Write-Host ""
Write-Host "Checkout temporal: $CheckoutDir"
