#!/usr/bin/env python3
"""
Script para generar órdenes de compra y tareas/eventos para proyectos específicos
Crea datos de prueba para proyectos 14, 15, 16 y 17 vinculados a sus oportunidades
"""

import sys
import random
from datetime import datetime, timedelta, UTC, date
from decimal import Decimal

sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.proyecto import Proyecto
from app.models.compras import PoOrder, PoOrderDetail, PoOrderStatus
from app.models.crm.evento import CRMEvento
from app.models.crm.catalogos import CRMTipoEvento
from app.models.enums import TipoCompra, EstadoEvento

def generar_datos_prueba_proyectos():
    print('=== GENERACION DE DATOS DE PRUEBA PARA PROYECTOS 14-17 ===')
    print()
    
    try:
        session = next(get_session())
        
        # IDs de proyectos objetivo
        proyecto_ids = [14, 15, 16, 17]
        
        # Obtener los proyectos y sus oportunidades
        proyectos_data = []
        for pid in proyecto_ids:
            proyecto = session.get(Proyecto, pid)
            if not proyecto or not proyecto.oportunidad_id:
                print(f'⚠️  Proyecto {pid} no encontrado o sin oportunidad_id')
                continue
            proyectos_data.append({
                'proyecto': proyecto,
                'oportunidad_id': proyecto.oportunidad_id
            })
        
        print(f'Proyectos válidos encontrados: {len(proyectos_data)}')
        
        # Obtener estados de orden disponibles
        estados_orden = session.exec(select(PoOrderStatus).where(PoOrderStatus.activo == True)).all()
        estado_mapping = {estado.nombre: estado.id for estado in estados_orden}
        
        # Obtener tipos de evento disponibles  
        tipos_evento = session.exec(select(CRMTipoEvento).where(CRMTipoEvento.activo == True)).all()
        tipo_evento_ids = [tipo.id for tipo in tipos_evento]
        
        # Estados de evento disponibles
        estados_evento = ['pendiente', 'realizado', 'cancelado']
        
        print(f'Estados de orden disponibles: {list(estado_mapping.keys())}')
        print(f'Tipos de evento disponibles: {len(tipos_evento)}')
        print(f'Estados de evento: {estados_evento}')
        print()
        
        # Datos de prueba para órdenes de compra
        ordenes_data = [
            # Proyecto 14: Torres SP SRL
            {'titulo': 'Material de construcción - Cimientos', 'descripcion': 'Cemento, hierros y agregados para fundaciones', 'total': 15000},
            {'titulo': 'Sistemas eléctricos - Primera etapa', 'descripcion': 'Cables, tableros y accesorios eléctricos', 'total': 8500},
            {'titulo': 'Material sanitario', 'descripcion': 'Inodoros, lavatorios y grifería', 'total': 12000},
            {'titulo': 'Pintura y acabados', 'descripcion': 'Pinturas, pinceles y materiales de acabado', 'total': 6500},
            
            # Proyecto 15: Catamarca y Corrientes  
            {'titulo': 'Excavación y movimiento de suelos', 'descripcion': 'Alquiler de maquinaria para excavación', 'total': 25000},
            {'titulo': 'Estructura metálica', 'descripcion': 'Perfiles, soldaduras y elementos estruturales', 'total': 35000},
            {'titulo': 'Revestimientos cerámicos', 'descripcion': 'Cerámicos, adhesivos y materiales de colocación', 'total': 18000},
            
            # Proyecto 16: Florida 115-Obra Pringles
            {'titulo': 'Impermeabilización', 'descripcion': 'Membranas, selladores y materiales impermeables', 'total': 9500},
            {'titulo': 'Carpintería metálica', 'descripcion': 'Puertas, ventanas y herrajes metálicos', 'total': 22000},
            {'titulo': 'Sistema de climatización', 'descripcion': 'Equipos de aire acondicionado y ductos', 'total': 16500},
            {'titulo': 'Landscape y parquización', 'descripcion': 'Plantas, tierra y materiales para jardía', 'total': 7800},
            
            # Proyecto 17: Mate de Luna 1872
            {'titulo': 'Instalación de gas', 'descripcion': 'Cañerías, reguladores y medidores de gas', 'total': 11000},
            {'titulo': 'Aberturas de aluminio', 'descripcion': 'Ventanas, puertas y marcos de aluminio', 'total': 19500},
            {'titulo': 'Sistema de seguridad', 'descripcion': 'Cámaras, sensores y equipos de alarma', 'total': 13500}
        ]
        
        # Datos de prueba para eventos/tareas
        eventos_data = [
            # Eventos generales para todos los proyectos
            {'titulo': 'Reunión inicial con cliente', 'descripcion': 'Definición de alcance y cronograma del proyecto'},
            {'titulo': 'Inspección del sitio', 'descripcion': 'Relevamiento técnico y evaluación del terreno'},
            {'titulo': 'Presentación de propuesta', 'descripcion': 'Presentación de diseños y presupuesto al cliente'},
            {'titulo': 'Seguimiento de avance', 'descripcion': 'Control de progreso y resolución de inconvenientes'},
            {'titulo': 'Revisión técnica', 'descripcion': 'Verificación de cumplimiento de especificaciones'},
            {'titulo': 'Entrega parcial', 'descripcion': 'Entrega de etapa completada al cliente'},
            {'titulo': 'Control de calidad', 'descripcion': 'Inspección de calidad de trabajos realizados'},
            {'titulo': 'Coordinación con proveedores', 'descripcion': 'Gestión de entregas y servicios de terceros'}
        ]
        
        total_ordenes = 0
        total_eventos = 0
        
        # Generar datos para cada proyecto
        for i, data in enumerate(proyectos_data):
            proyecto = data['proyecto']
            oportunidad_id = data['oportunidad_id']
            
            print(f'=== PROYECTO {proyecto.id}: {proyecto.nombre} ===')
            print(f'Oportunidad ID: {oportunidad_id}')
            
            # Generar 3-4 órdenes de compra por proyecto
            ordenes_por_proyecto = ordenes_data[i*3:(i+1)*4] if i < len(proyectos_data)-1 else ordenes_data[i*3:]
            if not ordenes_por_proyecto:
                ordenes_por_proyecto = ordenes_data[-3:]  # Usar las últimas 3 como fallback
            
            print(f'Creando {len(ordenes_por_proyecto)} órdenes de compra...')
            
            for j, orden_info in enumerate(ordenes_por_proyecto):
                # Fecha random en los últimos 3 meses
                fecha_base = datetime.now(UTC) - timedelta(days=90)  
                fecha_orden = fecha_base + timedelta(days=random.randint(0, 90))
                fecha_necesidad = fecha_orden + timedelta(days=random.randint(7, 30))
                
                # Estado random
                estado_nombre = random.choice(['borrador', 'pendiente', 'cotizada', 'aprobada', 'en_proceso'])
                estado_id = estado_mapping.get(estado_nombre, 1)
                
                # Crear orden
                orden = PoOrder(
                    titulo=orden_info['titulo'],
                    tipo_solicitud_id=1,  # Asumir que existe tipo_solicitud id=1
                    departamento_id=4,  # Departamento "Proyectos"
                    order_status_id=estado_id,
                    metodo_pago_id=1,  # Asumir que existe metodo_pago id=1
                    tipo_compra=TipoCompra.NORMAL,
                    total=Decimal(str(orden_info['total'])),
                    fecha_necesidad=fecha_necesidad.date(),
                    comentario=f"Orden generada automáticamente para proyecto: {proyecto.nombre}",
                    solicitante_id=1,  # Usuario id=1
                    oportunidad_id=oportunidad_id,
                    created_at=fecha_orden,
                    updated_at=fecha_orden
                )
                
                session.add(orden)
                session.flush()  # Para obtener el ID
                
                # Crear detalle de orden
                detalle = PoOrderDetail(
                    order_id=orden.id,
                    descripcion=orden_info['descripcion'],
                    unidad_medida="unidad",
                    cantidad=Decimal("1"),
                    precio=Decimal(str(orden_info['total']))
                )
                
                session.add(detalle)
                total_ordenes += 1
                
                print(f'   ✅ Orden {j+1}: "{orden.titulo}" - ${orden.total} - Estado: {estado_nombre}')
            
            # Generar 5-6 eventos/tareas por proyecto
            eventos_proyecto = random.sample(eventos_data, k=min(6, len(eventos_data)))
            
            print(f'Creando {len(eventos_proyecto)} eventos/tareas...')
            
            for j, evento_info in enumerate(eventos_proyecto):
                # Fecha random en los últimos 3 meses
                fecha_base = datetime.now(UTC) - timedelta(days=90)
                fecha_evento = fecha_base + timedelta(days=random.randint(0, 90))
                
                # Estado random 
                estado = random.choice(estados_evento)
                
                # Tipo random
                tipo_id = random.choice(tipo_evento_ids)
                
                # Crear evento
                evento = CRMEvento(
                    oportunidad_id=oportunidad_id,
                    contacto_id=proyecto.oportunidad.contacto_id,  # Contacto de la oportunidad
                    tipo_id=tipo_id,
                    titulo=evento_info['titulo'],
                    fecha_evento=fecha_evento,
                    estado_evento=estado,
                    asignado_a_id=1,  # Usuario id=1
                    fecha_estado=fecha_evento, 
                    descripcion=evento_info['descripcion'],
                    resultado="Completado exitosamente" if estado == 'realizado' else None,
                    created_at=fecha_evento,
                    updated_at=fecha_evento
                )
                
                session.add(evento)
                total_eventos += 1
                
                print(f'   ✅ Evento {j+1}: "{evento.titulo}" - Estado: {estado}')
            
            print(f'   ✅ PROYECTO {proyecto.id} COMPLETADO')
            print('-' * 60)
        
        # Confirmar cambios
        session.commit()
        
        print()
        print('=== RESUMEN FINAL ===')
        print(f'✅ Proyectos procesados: {len(proyectos_data)}')
        print(f'✅ Órdenes de compra creadas: {total_ordenes}') 
        print(f'✅ Eventos/tareas creados: {total_eventos}')
        print(f'📊 Total registros agregados: {total_ordenes + total_eventos}')
        print()
        print('🎉 DATOS DE PRUEBA GENERADOS EXITOSAMENTE!')
        print('🔗 Todas las órdenes y eventos están vinculados a las oportunidades correspondientes')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Confirmar antes de ejecutar
    print('Este script creará órdenes de compra y eventos para los proyectos 14, 15, 16 y 17.')
    print('Distribuirá los datos en los últimos 3 meses con diferentes estados.')
    print()
    response = input('¿Continuar? (s/N): ').lower().strip()
    
    if response in ['s', 'si', 'yes', 'y']:
        generar_datos_prueba_proyectos()
    else:
        print('Operación cancelada por el usuario')