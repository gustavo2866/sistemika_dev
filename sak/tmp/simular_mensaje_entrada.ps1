# Script para simular mensaje de entrada
$payload = @{
    "canal" = "whatsapp"
    "contacto_referencia" = "+5491156384310"
    "asunto" = "Consulta inmobiliaria"
    "contenido" = "Hola! Estoy interesado en una propiedad en Palermo. ¿Podrían asesorarme sobre las opciones disponibles?"
}

$jsonPayload = $payload | ConvertTo-Json
Write-Host "Enviando mensaje de entrada..."
Write-Host "Payload: $jsonPayload"

try {
    $response = Invoke-RestMethod -Uri "https://sak-backend-3urfgqrzea-uc.a.run.app/crm/mensajes/entrada" -Method Post -Body $jsonPayload -ContentType "application/json"
    Write-Host "✅ Mensaje enviado exitosamente!"
    Write-Host "Respuesta:"
    $response | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "❌ Error al enviar mensaje:"
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalles: $($_.ErrorDetails.Message)"
    }
}