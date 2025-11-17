Param(
    [string]$BackendPath = (Join-Path $PSScriptRoot "..\\..\\..\\..\\backend"),
    [string]$ProdDbUrl = $Env:DATABASE_URL_PROD_DIRECT
)

# Ejecuta alembic upgrade head en producción.
# Requiere la URL directa (sin -pooler) para aplicar migraciones: DATABASE_URL_PROD_DIRECT.

if (-not $ProdDbUrl) {
    Write-Error "Define DATABASE_URL_PROD_DIRECT con la URL directa de Neon (sslmode=require) para migraciones."
    exit 1
}

Push-Location $BackendPath
try {
    $env:DATABASE_URL = $ProdDbUrl
    Write-Host "Ejecutando alembic upgrade head en $BackendPath ..."
    alembic upgrade head
}
finally {
    Pop-Location
}

Write-Host "Migración ejecutada."
