#!/usr/bin/env python3
"""
Verificar variedad en tipos de solicitud y proveedores de las OC de proyectos
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder
from app.models.tipo_solicitud import TipoSolicitud
from app.models.proveedor import Proveedor

def verificar_variedad_ordenes():
    print('=== VERIFICACION DE VARIEDAD EN OC DE PROYECTOS ===')
    print()
    
    try:
        session = next(get_session())
        
        # Obtener tipos de solicitud disponibles
        stmt_tipos = select(TipoSolicitud)
        tipos_solicitud = session.exec(stmt_tipos).all()
        tipos_mapping = {ts.id: ts.nombre for ts in tipos_solicitud}
        
        print('Tipos de solicitud disponibles:')
        for ts_id, ts_nombre in tipos_mapping.items():
            print(f'  ID {ts_id}: {ts_nombre}')
        
        # Obtener proveedores disponibles
        stmt_prov = select(Proveedor).where(Proveedor.activo == True)
        proveedores = session.exec(stmt_prov).all()
        prov_mapping = {p.id: p.nombre for p in proveedores}
        
        print(f'\nProveedores activos disponibles: {len(proveedores)}')
        if len(proveedores) <= 10:
            for prov_id, prov_nombre in prov_mapping.items():
                print(f'  ID {prov_id}: {prov_nombre}')
        else:
            # Mostrar solo algunos
            for i, (prov_id, prov_nombre) in enumerate(list(prov_mapping.items())[:5]):
                print(f'  ID {prov_id}: {prov_nombre}')
            print(f'  ... y {len(proveedores) - 5} proveedores más')
        
        print()
        
        # Obtener órdenes de proyectos
        stmt_ordenes = select(PoOrder).where(PoOrder.oportunidad_id.is_not(None))
        ordenes_proyecto = session.exec(stmt_ordenes).all()
        
        print(f'Total órdenes de proyectos: {len(ordenes_proyecto)}')
        print()
        
        # Analizar tipos de solicitud
        tipos_count = {}
        for orden in ordenes_proyecto:
            ts_id = orden.tipo_solicitud_id
            ts_nombre = tipos_mapping.get(ts_id, f'ID {ts_id}')
            tipos_count[ts_nombre] = tipos_count.get(ts_nombre, 0) + 1
        
        print('DISTRIBUCION POR TIPO DE SOLICITUD:')
        for ts_nombre, count in tipos_count.items():
            porcentaje = (count / len(ordenes_proyecto)) * 100
            print(f'  {ts_nombre}: {count} órdenes ({porcentaje:.1f}%)')
        
        variedad_tipos = len(tipos_count)
        print(f'  → Variedad: {variedad_tipos}/{len(tipos_solicitud)} tipos utilizados')
        
        # Analizar proveedores
        prov_count = {}
        ordenes_sin_proveedor = 0
        
        for orden in ordenes_proyecto:
            if orden.proveedor_id is None:
                ordenes_sin_proveedor += 1
            else:
                prov_nombre = prov_mapping.get(orden.proveedor_id, f'ID {orden.proveedor_id}')
                prov_count[prov_nombre] = prov_count.get(prov_nombre, 0) + 1
        
        print()
        print('DISTRIBUCION POR PROVEEDOR:')
        if ordenes_sin_proveedor > 0:
            porcentaje_sin = (ordenes_sin_proveedor / len(ordenes_proyecto)) * 100
            print(f'  SIN PROVEEDOR: {ordenes_sin_proveedor} órdenes ({porcentaje_sin:.1f}%)')
        
        for prov_nombre, count in sorted(prov_count.items(), key=lambda x: x[1], reverse=True)[:10]:
            porcentaje = (count / len(ordenes_proyecto)) * 100
            print(f'  {prov_nombre}: {count} órdenes ({porcentaje:.1f}%)')
        
        if len(prov_count) > 10:
            print(f'  ... y {len(prov_count) - 10} proveedores más')
        
        variedad_proveedores = len(prov_count)
        print(f'  → Variedad: {variedad_proveedores}/{len(proveedores)} proveedores utilizados')
        
        # Análisis por proyectos específicos
        print()
        print('ANALISIS POR PROYECTO (14-17):')
        proyecto_oportunidad_map = {14: 204, 15: 205, 16: 206, 17: 207}
        
        for proyecto_id, oportunidad_id in proyecto_oportunidad_map.items():
            ordenes_proy = [o for o in ordenes_proyecto if o.oportunidad_id == oportunidad_id]
            
            if ordenes_proy:
                tipos_proy = set(o.tipo_solicitud_id for o in ordenes_proy)
                provs_proy = set(o.proveedor_id for o in ordenes_proy if o.proveedor_id)
                sin_prov = sum(1 for o in ordenes_proy if o.proveedor_id is None)
                
                print(f'  Proyecto {proyecto_id}: {len(ordenes_proy)} órdenes')
                print(f'    Tipos solicitud: {len(tipos_proy)} diferentes')
                print(f'    Proveedores: {len(provs_proy)} diferentes, {sin_prov} sin proveedor')
        
        # Evaluación general
        print()
        print('=== EVALUACION DE VARIEDAD ===')
        
        if variedad_tipos < len(tipos_solicitud) * 0.5:
            print('⚠️  BAJA variedad en tipos de solicitud')
        else:
            print('✅ BUENA variedad en tipos de solicitud')
        
        if ordenes_sin_proveedor > len(ordenes_proyecto) * 0.8:
            print('❌ MUCHAS órdenes sin proveedor asignado')
        elif variedad_proveedores < 5:
            print('⚠️  BAJA variedad en proveedores')
        else:
            print('✅ BUENA variedad en proveedores')
            
        # Recomendaciones
        print()
        print('RECOMENDACIONES:')
        if variedad_tipos < len(tipos_solicitud):
            print(f'  • Utilizar más tipos de solicitud (actualmente {variedad_tipos}/{len(tipos_solicitud)})')
        
        if ordenes_sin_proveedor > len(ordenes_proyecto) * 0.3:
            print(f'  • Asignar proveedores a más órdenes ({ordenes_sin_proveedor} sin proveedor)')
        
        if variedad_proveedores < 10 and len(proveedores) >= 10:
            print(f'  • Distribuir entre más proveedores (actualmente {variedad_proveedores})')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verificar_variedad_ordenes()