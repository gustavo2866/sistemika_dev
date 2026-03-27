#!/usr/bin/env python3
"""
Script para generar datos de prueba para proyectos específicos
Genera ordenes de compra y tareas distribuidas en diferentes fechas y estados
"""

import sys
sys.path.insert(0, '.')
from sqlmodel import Session, select
from app.db import get_session
from app.models.compras import PoOrder, PoOrderDetail, PoOrderStatus
from app.models.tarea import Tarea
from app.models.tipo_solicitud import TipoSolicitud
from app.models.articulo import Articulo
from app.models.proveedor import Proveedor
from app.models.crm.oportunidad import CRMOportunidad
from app.models.proyecto import Proyecto
from datetime import date, datetime, timedelta
from decimal import Decimal
import random

def generar_datos_prueba():
    print('=== GENERACION DE DATOS DE PRUEBA ===')
    print('Proyectos objetivo: 14, 15, 16, 17')
    print()
    
    try:
        session = next(get_session())
        
        # Verificar que los proyectos existen y obtener sus oportunidades
        proyectos_objetivo = [14, 15, 16, 17]
        proyectos_data = []
        
        for proyecto_id in proyectos_objetivo:
            proyecto = session.get(Proyecto, proyecto_id)
            if not proyecto:
                print(f'❌ Proyecto {proyecto_id} no encontrado')
                continue
                
            oportunidad = None
            if proyecto.oportunidad_id:
                oportunidad = session.get(CRMOportunidad, proyecto.oportunidad_id)
                
            proyectos_data.append({
                'id': proyecto_id,
                'nombre': proyecto.nombre,
                'oportunidad_id': proyecto.oportunidad_id,
                'responsable_id': proyecto.responsable_id
            })
            
            print(f'✅ Proyecto {proyecto_id}: "{proyecto.nombre}"')
            print(f'   Oportunidad ID: {proyecto.oportunidad_id}')
        
        if not proyectos_data:
            print('❌ No se encontraron proyectos válidos')
            return
            
        print()
        print('Consultando datos maestros...')
        
        # Obtener IDs necesarios
        stmt_tipo_solicitud = select(TipoSolicitud).limit(1)
        tipo_solicitud = session.exec(stmt_tipo_solicitud).first()
        
        stmt_estados = select(PoOrderStatus).where(PoOrderStatus.activo == True)
        estados_disponibles = session.exec(stmt_estados).all()
        
        stmt_articulos = select(Articulo).where(Articulo.activo == True).limit(10)
        articulos = session.exec(stmt_articulos).all()
        
        stmt_proveedores = select(Proveedor).where(Proveedor.activo == True).limit(5)
        proveedores = session.exec(stmt_proveedores).all()
        
        print(f'Tipo solicitud ID: {tipo_solicitud.id if tipo_solicitud else "N/A"}')
        print(f'Estados disponibles: {len(estados_disponibles)}')
        print(f'Artículos disponibles: {len(articulos)}')
        print(f'Proveedores disponibles: {len(proveedores)}')
        
        if not tipo_solicitud or not estados_disponibles:
            print('❌ Faltan datos maestros necesarios')
            return
            
        # Generar fechas de los últimos 3 meses
        hoy = date.today()
        fechas_prueba = []
        
        # Enero 2026
        fechas_prueba.extend([
            date(2026, 1, 15), date(2026, 1, 20), date(2026, 1, 25)
        ])
        # Febrero 2026  
        fechas_prueba.extend([
            date(2026, 2, 5), date(2026, 2, 12), date(2026, 2, 18), date(2026, 2, 25)
        ])
        # Marzo 2026
        fechas_prueba.extend([
            date(2026, 3, 3), date(2026, 3, 10), date(2026, 3, 17), date(2026, 3, 24)
        ])
        
        print()
        print('=== GENERANDO ORDENES DE COMPRA ===')
        
        ordenes_por_proyecto = 3  # 3 ordenes por cada proyecto
        contador_ordenes = 0
        
        for proyecto_data in proyectos_data:
            print(f'Proyecto {proyecto_data["id"]}: "{proyecto_data["nombre"]}"')
            
            for i in range(ordenes_por_proyecto):
                fecha_orden = random.choice(fechas_prueba)
                estado_orden = random.choice(estados_disponibles)
                proveedor = random.choice(proveedores) if proveedores else None
                
                orden_data = {
                    "titulo": f"OC-{proyecto_data['id']}-{i+1:02d} - {proyecto_data['nombre'][:30]}",
                    "tipo_solicitud_id": tipo_solicitud.id,
                    "order_status_id": estado_orden.id,
                    "total": Decimal(str(random.randint(50000, 500000))),
                    "fecha_necesidad": fecha_orden,
                    "comentario": f"Orden generada automáticamente para proyecto {proyecto_data['id']} - {estado_orden.nombre}",
                    "solicitante_id": proyecto_data["responsable_id"],
                    "oportunidad_id": proyecto_data["oportunidad_id"],
                    "proveedor_id": proveedor.id if proveedor else None,
                }
                
                orden = PoOrder(**orden_data)
                session.add(orden)
                session.flush()
                
                # Generar detalles para la orden
                if articulos:
                    num_detalles = random.randint(2, 5)
                    for j in range(num_detalles):
                        articulo = random.choice(articulos)
                        cantidad = Decimal(str(random.randint(1, 50)))
                        precio = Decimal(str(random.randint(1000, 20000)))
                        importe = cantidad * precio
                        
                        detalle_data = {
                            "order_id": orden.id,
                            "articulo_id": articulo.id,
                            "cantidad": cantidad,
                            "precio": precio,
                            "importe": importe,
                            "descripcion": f"{articulo.nombre} - Ítem {j+1}",
                            "unidad_medida": "unidad",
                        }
                        detalle = PoOrderDetail(**detalle_data)
                        session.add(detalle)
                
                contador_ordenes += 1
                print(f'   ✅ Orden {contador_ordenes}: {orden.titulo} (Estado: {estado_orden.nombre})')
            
            print()
        
        print('=== GENERANDO TAREAS ===')
        
        estados_tarea = ['pendiente', 'en_progreso', 'completada', 'cancelada', 'pausada']
        prioridades = ['baja', 'media', 'alta', 'urgente']
        
        tareas_por_proyecto = 4  # 4 tareas por proyecto
        contador_tareas = 0
        
        for proyecto_data in proyectos_data:
            print(f'Proyecto {proyecto_data["id"]}: "{proyecto_data["nombre"]}"')
            
            for i in range(tareas_por_proyecto):
                fecha_tarea = random.choice(fechas_prueba) + timedelta(days=random.randint(0, 30))
                
                tareas_ejemplo = [
                    "Revisión de planos arquitectónicos",
                    "Coordinación con contratistas", 
                    "Solicitud de permisos municipales",
                    "Control de calidad de materiales",
                    "Supervisión de avance de obra",
                    "Gestión de pagos a proveedores"
                ]
                
                titulo_tarea = f"{random.choice(tareas_ejemplo)} - {proyecto_data['nombre'][:30]}"
                
                tarea_data = {
                    "titulo": titulo_tarea,
                    "descripcion": f"Tarea generada automáticamente para el proyecto {proyecto_data['id']} - {proyecto_data['nombre']}",
                    "estado": random.choice(estados_tarea),
                    "prioridad": random.choice(prioridades),
                    "fecha_vencimiento": fecha_tarea.isoformat(),
                    "user_id": proyecto_data["responsable_id"]
                }
                
                tarea = Tarea(**tarea_data)
                session.add(tarea)
                
                contador_tareas += 1
                print(f'   ✅ Tarea {contador_tareas}: {titulo_tarea[:50]}... (Estado: {tarea_data["estado"]})')
            
            print()
        
        # Commit de todas las transacciones
        session.commit()
        
        print('=== RESUMEN FINAL ===')
        print(f'✅ Proyectos procesados: {len(proyectos_data)}')
        print(f'✅ Órdenes de compra generadas: {contador_ordenes}')
        print(f'✅ Tareas generadas: {contador_tareas}')
        print()
        print('🎉 DATOS DE PRUEBA GENERADOS EXITOSAMENTE!')
        print('📊 Distribución en últimos 3 meses con diferentes estados')
        print('🔗 Todas las órdenes vinculadas a oportunidades correspondientes')
        
    except Exception as e:
        print(f'❌ ERROR: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    generar_datos_prueba()