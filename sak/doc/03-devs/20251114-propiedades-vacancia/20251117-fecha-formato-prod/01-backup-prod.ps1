Param(
    [string]$OutputFile = "$(Get-Date -Format 'yyyyMMdd_HHmmss')_neon_prod_backup.dump"
)

# Usa la URL de Neon producción (pooled o directa) documentada en doc/01-setup/environments.md.
# No guardes la contraseña en el archivo; usa PGPASSWORD en el entorno o se solicitará al ejecutar.

if (-not $Env:DATABASE_URL_PROD) {
    Write-Error "Define DATABASE_URL_PROD con la URL de Neon producción (sslmode=require)."
    exit 1
}

Write-Host "Creando backup completo de producción en $OutputFile ..."
pg_dump `
    --verbose `
    --format=custom `
    --file="$OutputFile" `
    $Env:DATABASE_URL_PROD

Write-Host "Backup finalizado."
