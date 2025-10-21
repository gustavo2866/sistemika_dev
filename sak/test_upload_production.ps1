# Script para probar el endpoint de upload en producción

$pdfFile = Get-Item "$env:USERPROFILE\Downloads\*.pdf" | Select-Object -First 1

if (-not $pdfFile) {
    Write-Host "❌ No se encontró ningún PDF en Descargas"
    exit 1
}

Write-Host "📄 Usando archivo: $($pdfFile.Name)"
Write-Host "📤 Subiendo a producción..."

$url = "https://sak-backend-94464199991.us-central1.run.app/api/v1/facturas/parse-pdf/"

# Crear boundary para multipart/form-data
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

# Leer el contenido del archivo
$fileBytes = [System.IO.File]::ReadAllBytes($pdfFile.FullName)
$fileEnc = [System.Text.Encoding]::GetEncoding('ISO-8859-1').GetString($fileBytes)

# Construir el body multipart
$bodyLines = (
    "--$boundary",
    "Content-Disposition: form-data; name=`"file`"; filename=`"$($pdfFile.Name)`"",
    "Content-Type: application/pdf$LF",
    $fileEnc,
    "--$boundary--$LF"
) -join $LF

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyLines -TimeoutSec 60
    Write-Host "✅ Upload exitoso!"
    Write-Host ""
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error en upload:"
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host $responseBody
    }
}
