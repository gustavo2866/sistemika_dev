#!/usr/bin/env python3
"""
Script para obtener el payload completo del endpoint de KPIs del dashboard
"""

import sys
import os
from pathlib import Path
import requests
import json
from datetime import datetime, timedelta

# Configurar path correctamente
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def test_endpoint_kpis():
    """Llama al endpoint real y muestra el payload completo"""
    
    # Configurar fechas (último mes)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    start_date_str = start_date.strftime("%Y-%m-%d")
    end_date_str = end_date.strftime("%Y-%m-%d")
    
    print(f"🌐 LLAMADA AL ENDPOINT DE KPIs")
    print(f"📅 Rango: {start_date_str} a {end_date_str}")
    print(f"=" * 70)
    
    # URL del endpoint (asumiendo servidor local)
    base_url = "http://localhost:8000"  # Ajustar si es diferente
    endpoint = f"/api/dashboard/proyectos"
    
    # Parámetros
    params = {
        "startDate": start_date_str,
        "endDate": end_date_str,
        "selectorPeriodo": "mensual",
        "limitTop": 5
    }
    
    try:
        print(f"📡 Llamando a: {base_url}{endpoint}")
        print(f"📋 Parámetros: {params}")
        print(f"\\n⏱️  REALIZANDO PETICIÓN...")
        
        # Realizar petición
        response = requests.get(f"{base_url}{endpoint}", params=params, timeout=30)
        
        if response.status_code == 200:
            payload = response.json()
            
            print(f"\\n✅ RESPUESTA EXITOSA (200)")
            print(f"📏 Tamaño respuesta: {len(response.text):,} caracteres")
            print(f"=" * 70)
            
            # Mostrar estructura general
            print(f"\\n📊 ESTRUCTURA DEL PAYLOAD:")
            for key in payload.keys():
                if isinstance(payload[key], dict):
                    sub_keys = list(payload[key].keys())[:5]  # Primeras 5 claves
                    extra = "..." if len(payload[key].keys()) > 5 else ""
                    print(f"   📦 {key}: {{{', '.join(sub_keys)}{extra}}}")
                elif isinstance(payload[key], list):
                    print(f"   📋 {key}: array[{len(payload[key])} elementos]")
                else:
                    print(f"   📄 {key}: {type(payload[key]).__name__}")
            
            # Mostrar KPIs nuevos en detalle
            if 'kpis_nuevos' in payload:
                print(f"\\n💡 DETALLE DE KPIs NUEVOS:")
                kpis_nuevos = payload['kpis_nuevos']
                
                for kpi_name, kpi_data in kpis_nuevos.items():
                    print(f"\\n   📈 {kpi_name.upper()}:")
                    if isinstance(kpi_data, dict):
                        for campo, valor in kpi_data.items():
                            if campo == 'por_periodo' and isinstance(valor, list):
                                print(f"       - {campo}: [{len(valor)} períodos]")
                                if len(valor) > 0:
                                    periodo_ejemplo = valor[0]
                                    print(f"         Ejemplo período: {periodo_ejemplo}")
                            elif isinstance(valor, (int, float)):
                                print(f"       - {campo}: ${valor:,.2f}" if 'importe' in campo or 'materiales' in campo or 'mo_' in campo else f"       - {campo}: {valor}")
                            else:
                                print(f"       - {campo}: {valor}")
            
            # Mostrar rankings si existen
            if 'ranking' in payload:
                print(f"\\n🏆 RANKINGS:")
                ranking = payload['ranking']
                for rank_name, rank_data in ranking.items():
                    if isinstance(rank_data, list):
                        print(f"   📋 {rank_name}: {len(rank_data)} elementos")
                        if len(rank_data) > 0:
                            print(f"       Ejemplo: {rank_data[0]}")
            
            # Mostrar distribución si existe
            if 'distribucion' in payload:
                print(f"\\n📊 DISTRIBUCIÓN:")
                distribucion = payload['distribucion']
                for dist_name, dist_data in distribucion.items():
                    if isinstance(dist_data, dict):
                        print(f"   📈 {dist_name}: {len(dist_data)} categorías")
            
            # Mostrar JSON completo de forma compacta
            print(f"\\n=" * 70)
            print(f"📄 PAYLOAD COMPLETO (JSON):")
            print(f"=" * 70)
            print(json.dumps(payload, indent=2, ensure_ascii=False, default=str))
            
        else:
            print(f"\\n❌ ERROR {response.status_code}: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print(f"\\n⚠️  CONEXIÓN FALLIDA - El servidor no está corriendo?")
        print(f"   💡 Tips:")
        print(f"      - Inicia el servidor: uvicorn app.main:app --reload")
        print(f"      - Verifica la URL: {base_url}")
        
    except requests.exceptions.Timeout:
        print(f"\\n⏱️  TIMEOUT - El servidor tardó más de 30 segundos")
        
    except Exception as e:
        print(f"\\n❌ ERROR INESPERADO: {e}")

if __name__ == "__main__":
    test_endpoint_kpis()