#!/usr/bin/env python3
"""
Script para generar órdenes de compra adicionales para proyectos 14-17
Agrega más órdenes de compra con datos variados y montos realistas
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
from app.models.enums import TipoCompra

def generar_ordenes_adicionales():
    print('=== GENERACION DE ORDENES DE COMPRA ADICIONALES ===')
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
        
        # Obtener estados de orden disponibles
        estados_orden = session.exec(select(PoOrderStatus).where(PoOrderStatus.activo == True)).all()
        estado_mapping = {estado.nombre: estado.id for estado in estados_orden}
        
        print(f'Estados de orden disponibles: {list(estado_mapping.keys())}')
        print()
        
        # Datos adicionales para órdenes de compra - más variados
        ordenes_adicionales = [
            # Materiales de construcción
            {'titulo': 'Hormigón elaborado H-21', 'descripcion': 'Hormigón elaborado para losas y columnas', 'total': 28000},
            {'titulo': 'Ladrillos cerámicos', 'descripcion': 'Ladrillos huecos 18cm para mampostería', 'total': 12500},
            {'titulo': 'Chapa y perfiles galvanizados', 'descripcion': 'Chapas onduladas y perfiles para estructura', 'total': 22000},
            {'titulo': 'Aislante térmico', 'descripcion': 'Lana de vidrio y poliestireno expandido', 'total': 8400},
            {'titulo': 'Membrana asfáltica', 'descripcion': 'Membranas para impermeabilización de techos', 'total': 9800},
            
            # Instalaciones
            {'titulo': 'Instalación eléctrica - Fase 2', 'descripcion': 'Cableado, tomacorrientes y llaves', 'total': 15600},
            {'titulo': 'Sistema de agua caliente', 'descripcion': 'Termotanques y cañerías para agua caliente', 'total': 14200},
            {'titulo': 'Red cloacal interna', 'descripcion': 'Cañerías y accesorios para desagües', 'total': 11800},
            {'titulo': 'Sistema contra incendios', 'descripcion': 'Extintores, detectores de humo y señalización', 'total': 7500},
            {'titulo': 'Red de telefonía y datos', 'descripcion': 'Cables UTP, patch panels y conectores', 'total': 6900},
            
            # Equipamiento y herramientas
            {'titulo': 'Alquiler de equipos', 'descripcion': 'Grúa y elevador para trabajos en altura', 'total': 18500},
            {'titulo': 'Herramientas especializadas', 'descripcion': 'Taladros, amoladoras y equipos de corte', 'total': 5200},
            {'titulo': 'Andamios y estructuras temporales', 'descripcion': 'Alquiler de andamios para obras', 'total': 8900},
            {'titulo': 'Equipos de seguridad', 'descripcion': 'Cascos, arneses y elementos de protección', 'total': 4300},
            
            # Acabados y terminaciones
            {'titulo': 'Porcelanatos y cerámicos premium', 'descripcion': 'Revestimientos de primera calidad', 'total': 24000},
            {'titulo': 'Muebles de cocina', 'descripcion': 'Alacenas, mesadas y accesorios de cocina', 'total': 16800},
            {'titulo': 'Sanitarios de lujo', 'descripcion': 'Inodoros, bidets y grifería premium', 'total': 13400},
            {'titulo': 'Puertas de seguridad', 'descripcion': 'Puertas blindadas y cerraduras multipunto', 'total': 11200},
            {'titulo': 'Sistema de iluminación LED', 'descripcion': 'Luminarias LED y sistemas de control', 'total': 9600},
            {'titulo': 'Pisos de madera', 'descripcion': 'Parquet y pisos flotantes de calidad', 'total': 21500},
            
            # Servicios especializados
            {'titulo': 'Estudio de suelos', 'descripcion': 'Análisis geotécnico del terreno', 'total': 5800},
            {'titulo': 'Topografía y replanteo', 'descripcion': 'Servicios topográficos para la obra', 'total': 4500},
            {'titulo': 'Asesoría técnica estructural', 'descripcion': 'Consultoría de ingeniería estructural', 'total': 7200},
            {'titulo': 'Certificación energética', 'descripcion': 'Auditoría y certificación energética', 'total': 3200},
        ]
        
        total_ordenes = 0
        
        # Generar 5-8 órdenes adicionales por proyecto
        for data in proyectos_data:
            proyecto = data['proyecto']
            oportunidad_id = data['oportunidad_id']
            
            print(f'=== PROYECTO {proyecto.id}: {proyecto.nombre} ===')
            print(f'Oportunidad ID: {oportunidad_id}')
            
            # Seleccionar 6 órdenes random de la lista
            ordenes_seleccionadas = random.sample(ordenes_adicionales, k=6)
            
            print(f'Creando {len(ordenes_seleccionadas)} órdenes de compra adicionales...')
            
            for j, orden_info in enumerate(ordenes_seleccionadas):
                # Fecha random en los últimos 4 meses (más amplio)
                fecha_base = datetime.now(UTC) - timedelta(days=120)  
                fecha_orden = fecha_base + timedelta(days=random.randint(0, 120))
                fecha_necesidad = fecha_orden + timedelta(days=random.randint(5, 45))
                
                # Estado random con más variedad
                estados_posibles = ['borrador', 'pendiente', 'cotizada', 'aprobada', 'en_proceso', 'solicitada']
                estado_nombre = random.choice(estados_posibles)
                estado_id = estado_mapping.get(estado_nombre, 1)
                
                # Variar el total ±20%
                variacion = random.uniform(0.8, 1.2)
                total_variado = int(orden_info['total'] * variacion)
                
                # Crear orden
                orden = PoOrder(
                    titulo=orden_info['titulo'],
                    tipo_solicitud_id=random.randint(1, 3),  # Variar tipo de solicitud
                    departamento_id=4,  # Departamento "Proyectos" 
                    order_status_id=estado_id,
                    metodo_pago_id=random.randint(1, 2),  # Variar método de pago
                    tipo_compra=random.choice([TipoCompra.NORMAL, TipoCompra.DIRECTA]),
                    total=Decimal(str(total_variado)),
                    fecha_necesidad=fecha_necesidad.date(),
                    comentario=f"Orden adicional para proyecto: {proyecto.nombre} - {orden_info['descripcion'][:50]}",
                    solicitante_id=random.randint(1, 2),  # Variar solicitante
                    oportunidad_id=oportunidad_id,
                    created_at=fecha_orden,
                    updated_at=fecha_orden
                )
                
                session.add(orden)
                session.flush()  # Para obtener el ID
                
                # Crear 1-3 detalles por orden
                num_detalles = random.randint(1, 3)
                precio_por_detalle = Decimal(str(total_variado)) / num_detalles
                
                for k in range(num_detalles):
                    detalle_desc = f"{orden_info['descripcion']} - Item {k+1}" if num_detalles > 1 else orden_info['descripcion']
                    cantidad = Decimal(str(random.randint(1, 10)))
                    precio_unitario = precio_por_detalle / cantidad
                    
                    detalle = PoOrderDetail(
                        order_id=orden.id,
                        descripcion=detalle_desc,
                        unidad_medida=random.choice(["unidad", "m2", "m3", "kg", "litros"]),
                        cantidad=cantidad,
                        precio=precio_unitario
                    )
                    
                    session.add(detalle)
                
                total_ordenes += 1
                
                print(f'   ✅ Orden {j+1}: "{orden.titulo}" - ${orden.total:,} - Estado: {estado_nombre}')
            
            print(f'   ✅ PROYECTO {proyecto.id} COMPLETADO')
            print('-' * 60)
        
        # Confirmar cambios
        session.commit()
        
        print()
        print('=== RESUMEN FINAL ===')
        print(f'✅ Proyectos procesados: {len(proyectos_data)}')
        print(f'✅ Órdenes adicionales creadas: {total_ordenes}') 
        print(f'📊 Total registros agregados: {total_ordenes}')
        print()
        print('🎉 ORDENES ADICIONALES GENERADAS EXITOSAMENTE!')
        print('💰 Incluye materiales, instalaciones, equipos y servicios variados')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Confirmar antes de ejecutar
    print('Este script creará 6 órdenes de compra adicionales para cada proyecto (14-17).')
    print('Incluye materiales variados, instalaciones, equipos y servicios especializados.')
    print()
    response = input('¿Continuar? (s/N): ').lower().strip()
    
    if response in ['s', 'si', 'yes', 'y']:
        generar_ordenes_adicionales()
    else:
        print('Operación cancelada por el usuario')