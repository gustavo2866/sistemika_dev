# Script para simular webhook de Meta WhatsApp
$payload = @{
    "event_type" = "message.received"
    "timestamp" = "2026-01-17T15:30:00.000000Z"
    "mensaje" = @{
        "id" = "test-msg-" + (Get-Date -Format "yyyyMMddHHmmss")
        "meta_message_id" = "wamid.test123456789"
        "from_phone" = "5491156384310"
        "from_name" = "Cliente Test"
        "to_phone" = "+15551676015"
        "direccion" = "in"
        "tipo" = "text"
        "texto" = "Hola! Estoy interesado en una propiedad en Palermo. ¿Podrían asesorarme?"
        "media_id" = $null
        "caption" = $null
        "filename" = $null
        "mime_type" = $null
        "status" = "queued"
        "meta_timestamp" = "2026-01-17T15:30:00"
        "created_at" = "2026-01-17T15:30:00.123456"
        "celular" = @{
            "id" = "test-celular-id"
            "alias" = "WhatsApp Business"
            "phone_number" = "+15551676015"
        }
    }
}

$jsonPayload = $payload | ConvertTo-Json -Depth 10
Write-Host "Enviando webhook de WhatsApp..."
Write-Host "Payload: $jsonPayload"

try {
    $response = Invoke-RestMethod -Uri "https://sak-backend-3urfgqrzea-uc.a.run.app/api/webhooks/meta-whatsapp/" -Method Post -Body $jsonPayload -ContentType "application/json"
    Write-Host "✅ Webhook enviado exitosamente!"
    Write-Host "Respuesta:"
    $response | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "❌ Error al enviar webhook:"
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalles: $($_.ErrorDetails.Message)"
    }
}