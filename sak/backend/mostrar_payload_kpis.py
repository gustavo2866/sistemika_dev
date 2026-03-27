#!/usr/bin/env python3
"""
Script para generar el payload de KPIs del dashboard directamente (sin HTTP)
"""

import sys
import os
from pathlib import Path
import json
from datetime import datetime, timedelta

# Configurar path correctamente
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Imports después de configurar el path
from sqlmodel import Session, create_engine
from app.services.proyectos_dashboard import fetch_proyectos_for_dashboard, build_proyectos_dashboard_payload
from dotenv import load_dotenv

def get_database_session():
    """Crear sesión de base de datos"""
    load_dotenv()
    
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sak_dev")
    
    # Conectar a la base de datos
    engine = create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )
    
    return Session(engine)

async def generar_payload_kpis():
    """Genera el payload completo del dashboard de KPIs"""
    
    # Configurar fechas con datos conocidos (dic 2025 - ene 2026)
    start_date_str = "2025-12-01"
    end_date_str = "2026-01-31"
    
    print(f"📊 GENERANDO PAYLOAD DE KPIs DEL DASHBOARD")
    print(f"📅 Rango CON DATOS: {start_date_str} a {end_date_str}")
    print(f"=" * 70)
    
    session = get_database_session()
    
    try:
        print(f"\\n🔄 OBTENIENDO PROYECTOS...")
        
        # Obtener proyectos
        proyectos = fetch_proyectos_for_dashboard(
            session=session,
            start_date=start_date_str,
            end_date=end_date_str
        )
        
        print(f"   ✅ {len(proyectos)} proyectos obtenidos")
        
        print(f"\\n🔧 GENERANDO PAYLOAD COMPLETO...")
        
        # Generar payload completo
        payload = build_proyectos_dashboard_payload(
            items=proyectos,
            start_date=start_date_str,
            end_date=end_date_str,
            limit_top=5,
            filters={
                "responsable": None,
                "estado": None,
                "centroCosto": None,
            },
            session=session,
            periodo_tipo="mensual"
        )
        
        print(f"   ✅ Payload generado exitosamente")
        print(f"=" * 70)
        
        # Mostrar estructura general
        print(f"\\n📦 ESTRUCTURA DEL PAYLOAD:")
        for key in payload.keys():
            if isinstance(payload[key], dict):
                sub_keys = list(payload[key].keys())[:5]  # Primeras 5 claves
                extra = "..." if len(payload[key].keys()) > 5 else ""
                print(f"   📦 {key}: {{{', '.join(sub_keys)}{extra}}}")
            elif isinstance(payload[key], list):
                print(f"   📋 {key}: array[{len(payload[key])} elementos]")
            else:
                print(f"   📄 {key}: {type(payload[key]).__name__}")
        
        # Mostrar cada sección en detalle
        print(f"\\n📅 PERÍODO Y FILTROS:")
        if 'periodo' in payload:
            print(f"   📅 Período: {payload['periodo']}")
        if 'filtros' in payload:
            print(f"   🔍 Filtros: {payload['filtros']}")
        
        # Mostrar KPIs nuevos en detalle
        if 'kpis_nuevos' in payload:
            print(f"\\n💡 DETALLE DE KPIs NUEVOS:")
            kpis_nuevos = payload['kpis_nuevos']
            
            for kpi_name, kpi_data in kpis_nuevos.items():
                print(f"\\n   📈 {kpi_name.upper()}:")
                if isinstance(kpi_data, dict):
                    # Mostrar totales primero
                    totales_keys = [k for k in kpi_data.keys() if k != 'por_periodo']
                    for campo in totales_keys:
                        valor = kpi_data[campo]
                        if isinstance(valor, (int, float)):
                            if any(x in campo for x in ['importe', 'materiales', 'mo_propia', 'mo_terceros']):
                                print(f"       - {campo}: ${valor:,.2f}")
                            elif 'horas' in campo:
                                print(f"       - {campo}: {valor:,.1f}h")
                            else:
                                print(f"       - {campo}: {valor}")
                        else:
                            print(f"       - {campo}: {valor}")
                    
                    # Mostrar períodos si existen
                    if 'por_periodo' in kpi_data and isinstance(kpi_data['por_periodo'], list):
                        periodos = kpi_data['por_periodo']
                        print(f"       - por_periodo: [{len(periodos)} períodos]")
                        for i, periodo in enumerate(periodos):
                            print(f"         📅 Período {i+1}: {periodo}")
        
        # Mostrar rankings si existen
        if 'ranking' in payload:
            print(f"\\n🏆 RANKINGS:")
            ranking = payload['ranking']
            for rank_name, rank_data in ranking.items():
                if isinstance(rank_data, list):
                    print(f"\\n   📋 {rank_name}: {len(rank_data)} elementos")
                    for i, item in enumerate(rank_data[:3]):  # Mostrar primeros 3
                        print(f"       {i+1}. {item}")
                    if len(rank_data) > 3:
                        print(f"       ... y {len(rank_data) - 3} más")
        
        # Mostrar distribución si existe
        if 'distribucion' in payload:
            print(f"\\n📊 DISTRIBUCIÓN:")
            distribucion = payload['distribucion']
            for dist_name, dist_data in distribucion.items():
                print(f"\\n   📈 {dist_name}:")
                if isinstance(dist_data, dict):
                    for categoria, valor in dist_data.items():
                        print(f"       - {categoria}: {valor}")
        
        # Mostrar JSON completo
        print(f"\\n" + "=" * 70)
        print(f"📄 PAYLOAD COMPLETO (JSON):")
        print(f"=" * 70)
        try:
            payload_json = json.dumps(payload, indent=2, ensure_ascii=False, default=str)
            print(payload_json)
        except Exception as json_error:
            print(f"❌ Error serializando JSON: {json_error}")
            print("📋 Payload keys:", list(payload.keys()))
        
        # Guardar en archivo
        output_file = "payload_kpis_dashboard.json"
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(payload, f, indent=2, ensure_ascii=False, default=str)
            print(f"\\n💾 Payload guardado en: {output_file}")
        except Exception as save_error:
            print(f"❌ Error guardando archivo: {save_error}")
            
    except Exception as e:
        print(f"❌ Error generando payload: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(generar_payload_kpis())