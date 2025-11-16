"""
Test final con distintos rangos de fechas y filtros.
"""

import requests
from datetime import datetime, timedelta

API_URL = "http://localhost:8000/api/dashboard/vacancias"

print("🧪 TEST FINAL - Dashboard de Vacancias")
print("="*60)

tests = [
    {
        "nombre": "Últimos 30 días",
        "start": (datetime.now() - timedelta(days=30)).date().isoformat(),
        "end": datetime.now().date().isoformat(),
        "filtros": {}
    },
    {
        "nombre": "Último año completo",
        "start": "2024-01-01",
        "end": "2024-12-31",
        "filtros": {}
    },
    {
        "nombre": "Año 2025 hasta hoy",
        "start": "2025-01-01",
        "end": datetime.now().date().isoformat(),
        "filtros": {}
    },
    {
        "nombre": "Todo el histórico",
        "start": "2022-01-01",
        "end": datetime.now().date().isoformat(),
        "filtros": {}
    },
    {
        "nombre": "Propiedades disponibles (último año)",
        "start": "2024-01-01",
        "end": datetime.now().date().isoformat(),
        "filtros": {"estadoPropiedad": "3-disponible"}
    },
    {
        "nombre": "Departamentos de 2 ambientes",
        "start": "2023-01-01",
        "end": datetime.now().date().isoformat(),
        "filtros": {"ambientes": 2}
    },
]

resultados = []

for test in tests:
    print(f"\n📊 Test: {test['nombre']}")
    print(f"   Rango: {test['start']} a {test['end']}")
    if test['filtros']:
        print(f"   Filtros: {test['filtros']}")
    
    params = {
        'startDate': test['start'],
        'endDate': test['end'],
        'limitTop': 3,
        **test['filtros']
    }
    
    try:
        response = requests.get(API_URL, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            kpis = data['kpis']
            
            print(f"   ✅ Total vacancias: {kpis['totalVacancias']}")
            print(f"      Promedio días: {kpis['promedioDiasTotales']}")
            print(f"      Buckets: {len(data['buckets'])}")
            print(f"      Activas: {data['estados_finales']['activo']}, "
                  f"Alquiladas: {data['estados_finales']['alquilada']}, "
                  f"Retiradas: {data['estados_finales']['retirada']}")
            
            resultados.append({
                "test": test['nombre'],
                "status": "✅ PASS",
                "vacancias": kpis['totalVacancias']
            })
        else:
            print(f"   ❌ Error HTTP {response.status_code}")
            resultados.append({
                "test": test['nombre'],
                "status": f"❌ FAIL ({response.status_code})",
                "vacancias": 0
            })
    
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        resultados.append({
            "test": test['nombre'],
            "status": f"❌ ERROR ({type(e).__name__})",
            "vacancias": 0
        })

print(f"\n{'='*60}")
print("📋 RESUMEN FINAL")
print(f"{'='*60}")

total_tests = len(resultados)
passed = sum(1 for r in resultados if "PASS" in r['status'])
failed = total_tests - passed

print(f"\nTests ejecutados: {total_tests}")
print(f"✅ Pasados: {passed}")
print(f"❌ Fallidos: {failed}")

if failed == 0:
    print(f"\n🎉 TODOS LOS TESTS PASARON")
    print(f"✅ Dashboard completamente funcional")
else:
    print(f"\n⚠️  Algunos tests fallaron")
    for r in resultados:
        if "FAIL" in r['status'] or "ERROR" in r['status']:
            print(f"   - {r['test']}: {r['status']}")
