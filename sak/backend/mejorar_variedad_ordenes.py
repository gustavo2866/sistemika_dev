#!/usr/bin/env python3
"""
Mejorar la variedad de tipos de solicitud y asignar proveedores a las OC de proyectos
"""

import sys
import random
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder
from app.models.tipo_solicitud import TipoSolicitud
from app.models.proveedor import Proveedor

def mejorar_variedad_ordenes():
    print('=== MEJORANDO VARIEDAD EN OC DE PROYECTOS ===')
    print()
    
    try:
        session = next(get_session())
        
        # Obtener tipos de solicitud disponibles
        stmt_tipos = select(TipoSolicitud)
        tipos_solicitud = session.exec(stmt_tipos).all()
        tipos_ids = [ts.id for ts in tipos_solicitud]
        tipos_mapping = {ts.id: ts.nombre for ts in tipos_solicitud}
        
        # Obtener proveedores activos
        stmt_prov = select(Proveedor).where(Proveedor.activo == True)
        proveedores = session.exec(stmt_prov).all()
        prov_ids = [p.id for p in proveedores]
        prov_mapping = {p.id: p.nombre for p in proveedores}
        
        print(f'Tipos de solicitud disponibles: {len(tipos_ids)}')
        print(f'Proveedores activos disponibles: {len(prov_ids)}')
        print()
        
        # Obtener órdenes de proyectos
        stmt_ordenes = select(PoOrder).where(PoOrder.oportunidad_id.is_not(None))
        ordenes_proyecto = session.exec(stmt_ordenes).all()
        
        print(f'Total órdenes de proyectos: {len(ordenes_proyecto)}')
        
        # Estrategia de mejora
        categorias_tipos = {
            'materiales': [1, 2],    # Materiales, Ferretería
            'servicios': [3, 5, 6],  # Servicios, Transporte, Mensajería  
            'insumos': [4]           # Insumos de Oficina
        }
        
        # Mapeo de títulos de órdenes a tipos más apropiados
        mapeo_titulos_tipos = {
            'hormigón': 1,      # Materiales
            'ladrillos': 1,     # Materiales
            'chapa': 1,         # Materiales
            'cemento': 1,       # Materiales
            'pintura': 2,       # Ferretería
            'eléctrico': 2,     # Ferretería
            'sanitario': 2,     # Ferretería
            'instalación': 3,   # Servicios
            'sistema': 3,       # Servicios
            'alquiler': 5,      # Transporte
            'estudio': 3,       # Servicios
            'asesoría': 3,      # Servicios
            'certificación': 3, # Servicios
            'topografía': 3,    # Servicios
        }
        
        # Mapeo de tipos de material a proveedores apropiados
        mapeo_tipo_proveedor = {
            1: [1, 3],     # Materiales → Proveedor Demo, ConSur
            2: [2, 5],     # Ferretería → Eléctricos SA, TecSys  
            3: [5, 6],     # Servicios → TecSys, Varios
            4: [4, 6],     # Insumos → Limpi Total, Varios
            5: [6],        # Transporte → Varios
            6: [6]         # Mensajería → Varios
        }
        
        correcciones_tipos = 0
        asignaciones_proveedores = 0
        
        print('Mejorando variedad...')
        
        for orden in ordenes_proyecto:
            necesita_guardar = False
            
            # 1. Mejorar tipo de solicitud basado en el título
            titulo_lower = orden.titulo.lower()
            nuevo_tipo = None
            
            for keyword, tipo_id in mapeo_titulos_tipos.items():
                if keyword in titulo_lower:
                    nuevo_tipo = tipo_id
                    break
            
            # Si no encontramos un mapeo específico, usar distribución más balanceada
            if nuevo_tipo is None:
                # Evitar concentrar todo en "Materiales" (id=1)
                if orden.tipo_solicitud_id == 1 and random.random() < 0.4:  # 40% chance de cambiar
                    nuevo_tipo = random.choice([2, 3, 5])  # Más variedad
            
            if nuevo_tipo and nuevo_tipo != orden.tipo_solicitud_id:
                orden.tipo_solicitud_id = nuevo_tipo
                correcciones_tipos += 1
                necesita_guardar = True
            
            # 2. Asignar proveedor si no tiene uno
            if orden.proveedor_id is None:
                tipo_actual = orden.tipo_solicitud_id
                proveedores_apropiados = mapeo_tipo_proveedor.get(tipo_actual, prov_ids)
                
                # Seleccionar proveedor apropiado para el tipo
                nuevo_proveedor = random.choice(proveedores_apropiados)
                orden.proveedor_id = nuevo_proveedor
                asignaciones_proveedores += 1
                necesita_guardar = True
            
            if necesita_guardar:
                session.add(orden)
        
        # Confirmar cambios
        session.commit()
        
        print(f'✅ Tipos de solicitud actualizados: {correcciones_tipos}')
        print(f'✅ Proveedores asignados: {asignaciones_proveedores}')
        
        # Verificación final
        print()
        print('VERIFICACION FINAL:')
        
        # Recalcular distribución de tipos
        ordenes_actualizadas = session.exec(select(PoOrder).where(PoOrder.oportunidad_id.is_not(None))).all()
        
        tipos_count = {}
        prov_count = {}
        sin_proveedor = 0
        
        for orden in ordenes_actualizadas:
            # Tipos
            ts_nombre = tipos_mapping.get(orden.tipo_solicitud_id, f'ID {orden.tipo_solicitud_id}')
            tipos_count[ts_nombre] = tipos_count.get(ts_nombre, 0) + 1
            
            # Proveedores
            if orden.proveedor_id is None:
                sin_proveedor += 1
            else:
                prov_nombre = prov_mapping.get(orden.proveedor_id, f'ID {orden.proveedor_id}')
                prov_count[prov_nombre] = prov_count.get(prov_nombre, 0) + 1
        
        print('Nueva distribución de tipos de solicitud:')
        for tipo, count in tipos_count.items():
            porcentaje = (count / len(ordenes_actualizadas)) * 100
            print(f'  {tipo}: {count} ({porcentaje:.1f}%)')
        
        print()
        print('Nueva distribución de proveedores:')
        if sin_proveedor > 0:
            porcentaje = (sin_proveedor / len(ordenes_actualizadas)) * 100
            print(f'  SIN PROVEEDOR: {sin_proveedor} ({porcentaje:.1f}%)')
        
        for prov, count in sorted(prov_count.items(), key=lambda x: x[1], reverse=True):
            porcentaje = (count / len(ordenes_actualizadas)) * 100
            print(f'  {prov}: {count} ({porcentaje:.1f}%)')
        
        print()
        print('🎉 VARIEDAD MEJORADA EXITOSAMENTE!')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Confirmar antes de ejecutar
    print('Este script mejorará la variedad en tipos de solicitud y proveedores.')
    print('Asignará proveedores apropiados y balanceará los tipos de solicitud.')
    print()
    response = input('¿Continuar? (s/N): ').lower().strip()
    
    if response in ['s', 'si', 'yes', 'y']:
        mejorar_variedad_ordenes()
    else:
        print('Operación cancelada por el usuario')