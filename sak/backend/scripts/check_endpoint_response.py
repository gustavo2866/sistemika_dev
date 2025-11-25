"""
Verifica la respuesta del endpoint del dashboard para ver los campos de evolución mensual
"""

import sys
from pathlib import Path
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json

# Agregar el directorio backend al path de Python
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Cargar variables de entorno
from dotenv import load_dotenv
env_file = backend_dir / ".env"
if env_file.exists():
    load_dotenv(env_file)
else:
    print(f"⚠️  Archivo .env no encontrado en {env_file}")

from sqlmodel import Session
from app.db import engine
from app.services.crm_dashboard import build_crm_dashboard_payload

print("\n" + "=" * 80)
print("  VERIFICACIÓN DE RESPUESTA DEL ENDPOINT DE DASHBOARD")
print("=" * 80 + "\n")

# Llamar al servicio
with Session(engine) as session:
    # Últimos 12 meses
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=365)
    
    payload = build_crm_dashboard_payload(
        session=session,
        start=start,
        end=end,
        tipo_operacion_ids=None,
        responsable_ids=None,
        tipo_propiedad=None,
        propietario=None,
        emprendimiento_ids=None,
    )

print("\n📊 Estructura de la evolución mensual:")
print("-" * 80)

if "evolucionMensual" in payload:
    evolucion = payload["evolucionMensual"]
    
    print(f"Número de buckets: {len(evolucion)}")
    
    if evolucion:
        print("\nPrimer bucket (ejemplo):")
        primer_bucket = evolucion[0]
        print(json.dumps(primer_bucket, indent=2, default=str))
        
        print("\nCampos disponibles en los buckets:")
        for key in primer_bucket.keys():
            print(f"  - {key}")
        
        print("\nResumen de todos los buckets:")
        print(f"{'Mes':<12} {'Totales':>8} {'Pendientes':>10} {'Ganadas':>8} {'Perdidas':>8}")
        print("-" * 80)
        
        for bucket in evolucion:
            mes = bucket.get("bucket", "N/A")
            totales = bucket.get("totales", 0)
            pendientes = bucket.get("pendientes", 0)
            ganadas = bucket.get("ganadas", 0)
            perdidas = bucket.get("perdidas", 0)
            
            print(f"{mes:<12} {totales:>8} {pendientes:>10} {ganadas:>8} {perdidas:>8}")
        
        # Verificar si tiene 'nuevas'
        tiene_nuevas = any("nuevas" in b for b in evolucion)
        tiene_pendientes = any("pendientes" in b for b in evolucion)
        
        print("\n" + "=" * 80)
        print(f"¿Tiene campo 'nuevas'?: {tiene_nuevas}")
        print(f"¿Tiene campo 'pendientes'?: {tiene_pendientes}")
        print("=" * 80)
    else:
        print("⚠️  No hay datos en evolucionMensual")
else:
    print("❌ No se encuentra el campo 'evolucionMensual' en el payload")
    print("\nCampos disponibles en el payload:")
    for key in payload.keys():
        print(f"  - {key}")

print()
