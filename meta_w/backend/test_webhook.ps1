# Script para probar webhook localmente
Write-Host "=== Probando webhook de verificación ===" -ForegroundColor Green

$verifyUrl = "http://localhost:8000/api/v1/webhooks/meta/whatsapp/?hub.mode=subscribe&hub.challenge=test_challenge_123&hub.verify_token=meta_webhook_verify_2025"

Write-Host "`nURL: $verifyUrl"
Write-Host "`nEsperando respuesta..."

try {
    $response = Invoke-WebRequest -Uri $verifyUrl -Method GET
    Write-Host "`n✅ Verificación exitosa!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Respuesta: $($response.Content)"
} catch {
    Write-Host "`n❌ Error en verificación" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host "`n`n=== Probando recepción de mensaje ===" -ForegroundColor Green

$webhookPayload = @{
    object = "whatsapp_business_account"
    entry = @(
        @{
            id = "123456789"
            changes = @(
                @{
                    value = @{
                        messaging_product = "whatsapp"
                        metadata = @{
                            display_phone_number = "15551234567"
                            phone_number_id = "891207920743299"
                        }
                        contacts = @(
                            @{
                                profile = @{
                                    name = "Test User"
                                }
                                wa_id = "5491156384310"
                            }
                        )
                        messages = @(
                            @{
                                from = "5491156384310"
                                id = "wamid.test123"
                                timestamp = "1700000000"
                                type = "text"
                                text = @{
                                    body = "Hola, este es un mensaje de prueba"
                                }
                            }
                        )
                    }
                    field = "messages"
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

$receiveUrl = "http://localhost:8000/api/v1/webhooks/meta/whatsapp/?empresa_id=692d787d-06c4-432e-a94e-cf0686e593eb"

Write-Host "`nURL: $receiveUrl"
Write-Host "`nPayload enviado..."

try {
    $response = Invoke-WebRequest -Uri $receiveUrl -Method POST -ContentType "application/json" -Body $webhookPayload
    Write-Host "`n✅ Mensaje recibido!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Respuesta: $($response.Content)"
} catch {
    Write-Host "`n❌ Error al recibir mensaje" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
