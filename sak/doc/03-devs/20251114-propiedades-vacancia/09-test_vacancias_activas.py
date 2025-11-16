"""
Test específico para verificar el manejo de vacancias activas
(ciclo_activo=True, sin fecha de cierre).
"""

import requests
from datetime import datetime

API_URL = "http://localhost:8000"

# Rango que incluya todas las vacancias (desde 2023)
end_date = datetime.now().date()
start_date = datetime(2023, 1, 1).date()

params = {
    'startDate': start_date.isoformat(),
    'endDate': end_date.isoformat(),
    'limitTop': 10,
    'includeItems': True  # Incluir items para ver detalles
}

print(f"🔍 Consultando dashboard con rango: {start_date} a {end_date}")
print(f"   (Incluye vacancias activas y cerradas)\n")

try:
    response = requests.get(f"{API_URL}/api/dashboard/vacancias", params=params, timeout=15)
    
    if response.status_code != 200:
        print(f"❌ Error HTTP {response.status_code}:")
        print(response.text[:500])
        exit(1)
    
    data = response.json()
    
    print("📊 KPIs:")
    for key, value in data['kpis'].items():
        print(f"  {key}: {value}")
    
    print(f"\n📦 Buckets: {len(data['buckets'])} encontrados")
    if len(data['buckets']) > 0:
        print("  Primeros 5 buckets:")
        for bucket in data['buckets'][:5]:
            print(f"    {bucket['bucket']:12} - {bucket['count']:2} vacancias, "
                  f"{bucket['dias_totales']:4} días totales, "
                  f"{bucket['dias_reparacion']:3} rep, "
                  f"{bucket['dias_disponible']:3} disp")
    else:
        print("  ⚠️  No hay buckets (posible problema)")
    
    print(f"\n🏁 Estados finales:")
    for estado, count in data['estados_finales'].items():
        print(f"  {estado:12} : {count}")
    
    total_estados = sum(data['estados_finales'].values())
    if total_estados != data['kpis']['totalVacancias']:
        print(f"  ⚠️  INCONSISTENCIA: suma de estados ({total_estados}) "
              f"!= totalVacancias ({data['kpis']['totalVacancias']})")
    
    print(f"\n🏆 Top {len(data['top'])} vacancias (por días totales):")
    for i, item in enumerate(data['top'], 1):
        v = item['vacancia']
        print(f"\n  {i}. Propiedad #{v['propiedad_id']}")
        print(f"     Ciclo activo: {v.get('ciclo_activo', '?')}")
        print(f"     Fecha recibida: {v.get('fecha_recibida', 'N/A')}")
        print(f"     Fecha alquilada: {v.get('fecha_alquilada', 'N/A')}")
        print(f"     Fecha retirada: {v.get('fecha_retirada', 'N/A')}")
        print(f"     📊 Días totales: {item['dias_totales']}")
        print(f"        Reparación: {item['dias_reparacion']} días")
        print(f"        Disponible: {item['dias_disponible']} días")
        print(f"        Estado corte: {item['estado_corte']}")
        print(f"        Bucket: {item['bucket']}")
    
    # Análisis de vacancias activas
    if 'items' in data:
        items = data['items']
        total = len(items)
        activas = [item for item in items if item['vacancia'].get('ciclo_activo')]
        cerradas = [item for item in items if not item['vacancia'].get('ciclo_activo')]
        
        print(f"\n📈 Análisis de items:")
        print(f"  Total: {total}")
        print(f"  Activas (ciclo_activo=True): {len(activas)}")
        print(f"  Cerradas (ciclo_activo=False): {len(cerradas)}")
        
        if len(activas) > 0:
            print(f"\n  ✅ Vacancias activas encontradas en el rango")
            print(f"     Verificando que se calculen correctamente...")
            
            # Verificar que activas tengan días calculados
            activas_con_dias = [item for item in activas if item['dias_totales'] > 0]
            print(f"     - Activas con días_totales > 0: {len(activas_con_dias)}/{len(activas)}")
            
            if len(activas_con_dias) < len(activas):
                print(f"     ⚠️  PROBLEMA: Algunas activas tienen días_totales = 0")
                for item in activas:
                    if item['dias_totales'] == 0:
                        v = item['vacancia']
                        print(f"        - Vacancia #{v['id']}: fecha_recibida={v.get('fecha_recibida', 'N/A')}")
    else:
        print(f"\n⚠️  No hay campo 'items' en respuesta (includeItems=True no funcionó)")
    
    print(f"\n{'='*60}")
    print("✅ Test completado")
    
except requests.exceptions.ConnectionError:
    print("❌ Error: No se pudo conectar al servidor")
    print("   ¿Está corriendo el backend en http://localhost:8000?")
    exit(1)
except requests.exceptions.Timeout:
    print("❌ Error: Timeout al hacer la petición")
    exit(1)
except Exception as e:
    print(f"❌ Error inesperado: {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()
    exit(1)
