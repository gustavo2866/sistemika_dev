# Ejecuta una serie de pruebas con curl (PowerShell)
$base = 'http://127.0.0.1:8000'

Write-Host 'Create item (no meta)'
curl -s -X POST "$base/items" -H 'Content-Type: application/json' -d '{"name":"cURL1","description":"desc"}' | Write-Host

Write-Host 'Create item (with meta)'
curl -s -X POST "$base/items" -H 'Content-Type: application/json' -d '{"id":12345,"name":"cURL2","creado_en":"2000-01-01T00:00:00Z"}' | Write-Host

Write-Host 'List items'
curl -s "$base/items" | Write-Host

# nota: para obtener id y hacer más requests se necesitaría parsear JSON en PowerShell
Write-Host 'Done'
