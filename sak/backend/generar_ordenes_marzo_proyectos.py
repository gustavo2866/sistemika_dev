#!/usr/bin/env python3
"""
Generar órdenes de compra adicionales para marzo 2026, asociadas a proyectos
"""

import sys
sys.path.insert(0, '.')
from datetime import datetime, timedelta
import random
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder, PoOrderStatusLog, TipoCompra, PoOrderStatus
from app.models.proveedor import Proveedor
from app.models.departamento import Departamento
from app.models.tipo_solicitud import TipoSolicitud
from app.models.user import User

def generar_ordenes_marzo_proyectos():
    print('=== GENERANDO ORDENES DE COMPRA - MARZO 2026 ===')
    
    try:
        session = next(get_session())
        
        # Obtener proveedores existentes
        proveedores = session.exec(select(Proveedor)).all()
        proveedor_ids = [p.id for p in proveedores]
        print(f'Proveedores disponibles: {len(proveedores)}')
        
        # Obtener tipos de solicitud
        tipos_solicitud = session.exec(select(TipoSolicitud)).all()
        tipo_solicitud_ids = [t.id for t in tipos_solicitud]
        print(f'Tipos de solicitud disponibles: {len(tipos_solicitud)}')
        
        # Obtener estados disponibles
        estados = session.exec(select(PoOrderStatus)).all()
        estado_ids = [e.id for e in estados]
        print(f'Estados disponibles: {len(estados)}')
        
        # Obtener oportunidades disponibles (para asociar las órdenes)
        from app.models.crm.oportunidad import CRMOportunidad
        oportunidades = session.exec(select(CRMOportunidad)).all()
        oportunidad_ids = [o.id for o in oportunidades]
        print(f'Oportunidades disponibles: {len(oportunidades)}')
        
        # Obtener usuarios disponibles (para asignar como solicitantes)
        usuarios = session.exec(select(User)).all()
        usuario_ids = [u.id for u in usuarios]
        print(f'Usuarios disponibles: {len(usuarios)}')
        
        # IDs fijos
        departamento_proyectos_id = 4  # Departamento Proyectos
        
        # Órdenes a generar para marzo
        ordenes_data = [
            # Materiales de construcción
            {
                'titulo': 'Cemento Portland 50kg x20',
                'descripcion': 'Cemento Portland tipo CPO para obras de construcción. Marca reconocida.',
                'tipo_base': 'Materiales',
                'proveedor_pref': ['ConSur', 'Proveedor Demo'],
                'total': 45000.00
            },
            {
                'titulo': 'Arena gruesa 10m³',
                'descripcion': 'Arena gruesa para mezcla de hormigón y mampostería.',
                'tipo_base': 'Materiales', 
                'proveedor_pref': ['ConSur', 'Varios'],
                'total': 85000.00
            },
            {
                'titulo': 'Hierro construcción Ø12mm x6m',
                'descripcion': 'Hierro para estructuras, varillas de 12mm x 6 metros. ADN 420.',
                'tipo_base': 'Materiales',
                'proveedor_pref': ['TecSys', 'ConSur'],
                'total': 120000.00
            },
            {
                'titulo': 'Ladrillo hueco 12x18x33 x500un',
                'descripcion': 'Ladrillos huecos para mampostería no portante.',
                'tipo_base': 'Materiales',
                'proveedor_pref': ['ConSur', 'Proveedor Demo'],
                'total': 67500.00
            },
            
            # Servicios especializados
            {
                'titulo': 'Instalación eléctrica plantas 2 y 3',
                'descripcion': 'Instalación completa de cableado eléctrico, tableros y tomas.',
                'tipo_base': 'Servicios',
                'proveedor_pref': ['Eléctricos SA', 'TecSys'],
                'total': 280000.00
            },
            {
                'titulo': 'Plomería baños principales',
                'descripcion': 'Instalación de sanitarios, grifería y desagües en baños principales.',
                'tipo_base': 'Servicios',
                'proveedor_pref': ['TecSys', 'Varios'],
                'total': 195000.00
            },
            {
                'titulo': 'Soldadura estructural vigas H',
                'descripcion': 'Soldadura de todas las uniones de vigas H de la estructura principal.',
                'tipo_base': 'Servicios',
                'proveedor_pref': ['ConSur', 'TecSys'],
                'total': 340000.00
            },
            {
                'titulo': 'Inspección técnica de obra',
                'descripcion': 'Inspección técnica quincenal de avance y calidad de obra.',
                'tipo_base': 'Servicios',
                'proveedor_pref': ['Varios', 'TecSys'],
                'total': 125000.00
            },
            
            # Herramientas y ferretería
            {
                'titulo': 'Taladro percutor industrial + mechas',
                'descripcion': 'Taladro percutor de 1200W con juego de mechas para concreto.',
                'tipo_base': 'Ferretería',
                'proveedor_pref': ['TecSys', 'Varios'],
                'total': 89000.00
            },
            {
                'titulo': 'Sierra circular 7¼" profesional',
                'descripcion': 'Sierra circular profesional con disco diamantado para corte preciso.',
                'tipo_base': 'Ferretería',
                'proveedor_pref': ['TecSys', 'Ferretería Lopez'],
                'total': 156000.00
            },
            {
                'titulo': 'Tornillería variada construcción',
                'descripcion': 'Surtido de tornillos autoperforantes, tirafondos y fijaciones varias.',
                'tipo_base': 'Ferretería',
                'proveedor_pref': ['Varios', 'TecSys'],
                'total': 34500.00
            },
            {
                'titulo': 'Escalera telescópica aluminio 6m',
                'descripcion': 'Escalera telescópica de aluminio, máximo 6 metros, certificada.',
                'tipo_base': 'Ferretería',
                'proveedor_pref': ['TecSys', 'Varios'],
                'total': 78000.00
            },
            
            # Transporte y logística
            {
                'titulo': 'Transporte materiales obra sector norte',
                'descripcion': 'Flete de materiales desde depósito a obra sector norte de la ciudad.',
                'tipo_base': 'Transporte',
                'proveedor_pref': ['Varios', 'ConSur'],
                'total': 95000.00
            },
            {
                'titulo': 'Alquiler minicargadora s/operador',
                'descripcion': 'Alquiler de minicargadora sin operador para movimiento de materiales.',
                'tipo_base': 'Transporte',
                'proveedor_pref': ['ConSur', 'Varios'],
                'total': 450000.00
            },
            {
                'titulo': 'Transporte escombros a vertedero',
                'descripcion': 'Retiro y transporte de escombros de demolición al vertedero autorizado.',
                'tipo_base': 'Transporte',
                'proveedor_pref': ['Varios', 'Limpi Total'],
                'total': 125000.00
            },
            
            # Mensajería y comunicaciones
            {
                'titulo': 'Sistema comunicación obra',
                'descripcion': 'Instalación de sistema de comunicación interna en obra.',
                'tipo_base': 'Mensajería',
                'proveedor_pref': ['TecSys', 'Varios'],
                'total': 67000.00
            }
        ]
        
        ordenes_creadas = []
        
        for i, orden_data in enumerate(ordenes_data):
            print(f'\nCreando orden {i+1}/{len(ordenes_data)}: {orden_data["titulo"]}')
            
            # Buscar tipo de solicitud por nombre base
            tipo_solicitud = next(
                (t for t in tipos_solicitud if t.nombre == orden_data['tipo_base']), 
                tipos_solicitud[0]
            )
            
            # Buscar proveedor preferido
            proveedor_elegido = None
            for pref_name in orden_data['proveedor_pref']:
                proveedor_elegido = next(
                    (p for p in proveedores if pref_name in p.nombre), 
                    None
                )
                if proveedor_elegido:
                    break
            
            if not proveedor_elegido:
                proveedor_elegido = random.choice(proveedores)
            
            # Estado aleatorio pero realista para marzo
            estado_elegido = random.choice(estados)
            
            # Fecha aleatoria en marzo 2026
            fecha_base = datetime(2026, 3, 1)
            dias_marzo = random.randint(1, 24)  # Hasta hoy 24 de marzo
            fecha_orden = fecha_base + timedelta(days=dias_marzo)
            
            # Oportunidad aleatoria
            oportunidad_id = random.choice(oportunidad_ids)
            
            # Usuario solicitante aleatorio
            solicitante_id = random.choice(usuario_ids)
            
            # Crear la orden
            nueva_orden = PoOrder(
                titulo=orden_data['titulo'],
                descripcion=orden_data['descripcion'],
                total=orden_data['total'],
                tipo_compra=TipoCompra.DIRECTA,
                departamento_id=departamento_proyectos_id,
                proveedor_id=proveedor_elegido.id,
                tipo_solicitud_id=tipo_solicitud.id,
                order_status_id=estado_elegido.id,
                oportunidad_id=oportunidad_id,
                solicitante_id=solicitante_id,
                created_at=fecha_orden,
                updated_at=fecha_orden
            )
            
            session.add(nueva_orden)
            session.flush()  # Para obtener el ID
            
            # Crear log de estado
            log_estado = PoOrderStatusLog(
                order_id=nueva_orden.id,
                status_nuevo_id=estado_elegido.id,
                usuario_id=solicitante_id,
                fecha_registro=fecha_orden.date(),
                created_at=fecha_orden,
                updated_at=fecha_orden
            )
            
            session.add(log_estado)
            
            ordenes_creadas.append({
                'id': nueva_orden.id,
                'titulo': nueva_orden.titulo,
                'proveedor': proveedor_elegido.nombre,
                'tipo': tipo_solicitud.nombre,
                'estado': estado_elegido.nombre,
                'total': nueva_orden.total,
                'fecha': fecha_orden.strftime('%d/%m/%Y')
            })
        
        session.commit()
        
        print(f'\n✅ ÉXITO: Se crearon {len(ordenes_creadas)} órdenes para marzo 2026')
        
        # Mostrar resumen
        print('\n=== ORDENES CREADAS ===')
        print('ID   | Título                           | Proveedor      | Tipo          | Estado      | Total        | Fecha')
        print('-' * 110)
        
        for orden in ordenes_creadas:
            titulo_corto = orden['titulo'][:30] + '...' if len(orden['titulo']) > 30 else orden['titulo']
            proveedor_corto = orden['proveedor'][:12]
            tipo_corto = orden['tipo'][:11]
            estado_corto = orden['estado'][:10]
            
            print(f"{orden['id']:4d} | {titulo_corto:32s} | {proveedor_corto:14s} | {tipo_corto:13s} | {estado_corto:11s} | ${orden['total']:9,.0f} | {orden['fecha']}")
        
        # Estadísticas
        total_ordenes = len(ordenes_creadas)
        total_monto = sum(orden['total'] for orden in ordenes_creadas)
        
        print(f'\nTotal órdenes: {total_ordenes}')
        print(f'Monto total: ${total_monto:,.2f}')
        
        # Distribución por tipo
        tipos_count = {}
        for orden in ordenes_creadas:
            tipos_count[orden['tipo']] = tipos_count.get(orden['tipo'], 0) + 1
        
        print('\nDistribución por tipo:')
        for tipo, count in sorted(tipos_count.items()):
            porcentaje = (count / total_ordenes) * 100
            print(f'  {tipo:15s}: {count:2d} órdenes ({porcentaje:4.1f}%)')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    generar_ordenes_marzo_proyectos()