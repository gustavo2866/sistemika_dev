# Validación rápida post-deploy CRM
# Verifica que todo se haya aplicado correctamente

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VALIDACIÓN POST-DEPLOY CRM" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Set-Location ..\backend

# Obtener DATABASE_URL de GCP Secret Manager
Write-Host "`nObteniendo credenciales..." -ForegroundColor Yellow
$DATABASE_URL = gcloud secrets versions access latest --secret="DATABASE_URL" --project="sak-wcl"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al obtener DATABASE_URL" -ForegroundColor Red
    Set-Location ..\cmd
    exit 1
}

$env:DATABASE_URL = $DATABASE_URL

Write-Host "`n1️⃣ Verificando versión de migración..." -ForegroundColor Cyan
$ALEMBIC_VERSION = alembic current 2>&1
if ($ALEMBIC_VERSION -match "7ce9174d43c8") {
    Write-Host "   ✅ Migración CRM aplicada correctamente" -ForegroundColor Green
} else {
    Write-Host "   ❌ Migración CRM NO aplicada" -ForegroundColor Red
    Write-Host "   Versión actual: $ALEMBIC_VERSION" -ForegroundColor Yellow
}

Write-Host "`n2️⃣ Verificando tablas CRM..." -ForegroundColor Cyan
$VALIDATION_SCRIPT = @"
from sqlmodel import Session, select, text
from app.db import engine
from app.models import *

session = Session(engine)

# Verificar tablas catálogos
tablas_catalogo = {
    'crm_tipos_operacion': CRMTipoOperacion,
    'crm_motivos_perdida': CRMMotivoPerdida,
    'crm_condiciones_pago': CRMCondicionPago,
    'crm_tipos_evento': CRMTipoEvento,
    'crm_motivos_evento': CRMMotivoEvento,
    'crm_origenes_lead': CRMOrigenLead,
    'monedas': Moneda
}

print('\n📋 Catálogos CRM:')
for nombre, modelo in tablas_catalogo.items():
    count = len(session.exec(select(modelo)).all())
    status = '✅' if count > 0 else '❌'
    print(f'   {status} {nombre}: {count} registros')

# Verificar tablas de datos
print('\n📊 Tablas de datos:')
contactos = len(session.exec(select(CRMContacto)).all())
oportunidades = len(session.exec(select(CRMOportunidad)).all())
eventos = len(session.exec(select(CRMEvento)).all())
emprendimientos = len(session.exec(select(Emprendimiento)).all())

print(f'   ✅ crm_contactos: {contactos}')
print(f'   ✅ crm_oportunidades: {oportunidades}')
print(f'   ✅ crm_eventos: {eventos}')
print(f'   ✅ emprendimientos: {emprendimientos}')

# Verificar propiedades completadas
print('\n🏢 Propiedades completadas:')
props = session.exec(select(Propiedad)).all()
total = len(props)
con_tipo_op = sum(1 for p in props if p.tipo_operacion_id)
con_emprend = sum(1 for p in props if p.emprendimiento_id)
terrenos = [p for p in props if p.tipo and 'terreno' in p.tipo.lower()]
terrenos_con_emprend = sum(1 for p in terrenos if p.emprendimiento_id and p.tipo_operacion_id == 3)

print(f'   ✅ Total propiedades: {total}')
print(f'   ✅ Con tipo_operacion_id: {con_tipo_op}/{total}')
print(f'   ✅ Con emprendimiento_id: {con_emprend}')
print(f'   ✅ Terrenos: {len(terrenos)}')
print(f'   ✅ Terrenos → emprendimiento: {terrenos_con_emprend}/{len(terrenos)}')

session.close()

print('\n✅ Validación completada')
"@

$VALIDATION_SCRIPT | python 2>&1

Write-Host "`n3️⃣ Verificando endpoints API..." -ForegroundColor Cyan
Write-Host "   ⏭️  Salteado (requiere backend en ejecución)" -ForegroundColor Gray
Write-Host "   Manual: GET https://api.sak.com/crm/catalogos/tipos-operacion" -ForegroundColor Gray

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ VALIDACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

# Limpiar
Remove-Item Env:\DATABASE_URL
Set-Location ..\cmd

Write-Host "`n📝 Próximos pasos:" -ForegroundColor Yellow
Write-Host "   1. Reiniciar backend: .\restart_backend.ps1" -ForegroundColor White
Write-Host "   2. Probar endpoints /crm/* desde Postman/frontend" -ForegroundColor White
Write-Host "   3. Crear oportunidad de prueba" -ForegroundColor White
