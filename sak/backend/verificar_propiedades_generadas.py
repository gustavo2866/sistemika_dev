#!/usr/bin/env python3
"""
Script para verificar la consistencia de las propiedades generadas
y mostrar un reporte detallado del estado actual.
"""
import os
import sys
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

from sqlalchemy import create_engine, text

# Obtener DATABASE_URL del entorno
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sak_dev")

# Ajustar URL si es necesario
if DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")

def main():
    """Función principal del script."""
    
    # Crear conexión a la base de datos
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("=== VERIFICACIÓN DE PROPIEDADES GENERADAS ===\n")
        
        # Consultar propiedades creadas recientemente (últimas 24 horas)
        consulta_propiedades = text("""
            SELECT 
                p.id,
                p.nombre,
                p.propietario,
                ps.nombre as estado,
                p.estado_fecha,
                p.vacancia_activa,
                p.vacancia_fecha,
                tp.nombre as tipo_propiedad,
                tol.nombre as tipo_operacion,
                p.valor_alquiler,
                p.ambientes,
                p.metros_cuadrados,
                p.created_at
            FROM propiedades p
            LEFT JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
            LEFT JOIN tipos_propiedad tp ON p.tipo_propiedad_id = tp.id
            LEFT JOIN crm_tipos_operacion tol ON p.tipo_operacion_id = tol.id
            WHERE p.created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY p.id
        """)
        
        propiedades = conn.execute(consulta_propiedades).fetchall()
        
        if not propiedades:
            print("No se encontraron propiedades creadas en las últimas 24 horas.")
            return
        
        print(f"📋 PROPIEDADES CREADAS RECIENTEMENTE: {len(propiedades)}")
        print("=" * 100)
        
        estados_count = {}
        
        for i, prop in enumerate(propiedades, 1):
            # Contar estados
            estado_nombre = prop.estado or "Sin Estado"
            estados_count[estado_nombre] = estados_count.get(estado_nombre, 0) + 1
            
            # Formatear información
            vacancia_icon = "🟢" if prop.vacancia_activa else "🔴"
            valor_str = f"${prop.valor_alquiler:,.0f}" if prop.valor_alquiler else "N/A"
            ambientes_str = f"{prop.ambientes}amb" if prop.ambientes else "N/A"
            metros_str = f"{prop.metros_cuadrados}m²" if prop.metros_cuadrados else "N/A"
            
            print(f"{i:2d}. ID {prop.id:3d} | {prop.nombre:<35} | {estado_nombre:<15}")
            print(f"    Propietario: {prop.propietario}")
            print(f"    Tipo: {prop.tipo_propiedad or 'N/A'} / {prop.tipo_operacion or 'N/A'}")
            print(f"    Características: {ambientes_str}, {metros_str}, Alquiler: {valor_str}")
            print(f"    {vacancia_icon} Vacancia: {'Activa' if prop.vacancia_activa else 'Inactiva'} (desde: {prop.vacancia_fecha})")
            print(f"    Estado desde: {prop.estado_fecha} | Creada: {prop.created_at.strftime('%Y-%m-%d %H:%M')}")
            print("-" * 100)
        
        # Resumen estadístico
        print(f"\n📊 RESUMEN ESTADÍSTICO")
        print("=" * 50)
        print(f"Total de propiedades: {len(propiedades)}")
        print(f"\nDistribución por estado:")
        for estado, count in sorted(estados_count.items()):
            porcentaje = (count / len(propiedades)) * 100
            print(f"  • {estado}: {count} propiedades ({porcentaje:.1f}%)")
        
        # Verificar logs de estado
        print(f"\n📈 VERIFICACIÓN DE LOGS DE ESTADO")
        print("=" * 50)
        
        ids_propiedades = tuple(prop.id for prop in propiedades)
        
        consulta_logs = text("""
            SELECT 
                pls.propiedad_id,
                p.nombre,
                pls.estado_anterior,
                pls.estado_nuevo,
                pls.fecha_cambio,
                u.nombre as usuario,
                pls.motivo
            FROM propiedades_log_status pls
            JOIN propiedades p ON pls.propiedad_id = p.id
            LEFT JOIN users u ON pls.usuario_id = u.id
            WHERE pls.propiedad_id IN :ids
            ORDER BY pls.propiedad_id, pls.fecha_cambio
        """)
        
        logs = conn.execute(consulta_logs, {'ids': ids_propiedades}).fetchall()
        
        # Agrupar logs por propiedad
        logs_por_propiedad = {}
        for log in logs:
            prop_id = log.propiedad_id
            if prop_id not in logs_por_propiedad:
                logs_por_propiedad[prop_id] = []
            logs_por_propiedad[prop_id].append(log)
        
        print(f"Total de logs encontrados: {len(logs)}")
        
        # Mostrar algunas muestras de logs
        propiedades_ejemplo = list(logs_por_propiedad.keys())[:5]
        
        for prop_id in propiedades_ejemplo:
            prop_nombre = next(p.nombre for p in propiedades if p.id == prop_id)
            print(f"\n🔄 Historial de estados - {prop_nombre} (ID: {prop_id}):")
            
            for log in logs_por_propiedad[prop_id]:
                estado_anterior = log.estado_anterior or "INICIAL"
                fecha_str = log.fecha_cambio.strftime('%Y-%m-%d %H:%M')
                print(f"    {estado_anterior} ➜ {log.estado_nuevo} | {fecha_str} | {log.usuario} | {log.motivo}")
        
        # Verificación de integridad
        print(f"\n✅ VERIFICACIÓN DE INTEGRIDAD")
        print("=" * 50)
        
        # 1. Todas las propiedades deben tener vacancia_activa = true
        sin_vacancia = [p for p in propiedades if not p.vacancia_activa]
        if sin_vacancia:
            print(f"❌ {len(sin_vacancia)} propiedades sin vacancia_activa=true")
        else:
            print(f"✅ Todas las propiedades tienen vacancia_activa=true")
        
        # 2. Todas deben tener vacancia_fecha
        sin_fecha_vacancia = [p for p in propiedades if not p.vacancia_fecha]
        if sin_fecha_vacancia:
            print(f"❌ {len(sin_fecha_vacancia)} propiedades sin vacancia_fecha")
        else:
            print(f"✅ Todas las propiedades tienen vacancia_fecha")
        
        # 3. Todas deben tener al menos un log
        propiedades_sin_logs = [prop_id for prop_id in ids_propiedades if prop_id not in logs_por_propiedad]
        if propiedades_sin_logs:
            print(f"❌ {len(propiedades_sin_logs)} propiedades sin logs de estado")
        else:
            print(f"✅ Todas las propiedades tienen logs de estado")
        
        # 4. Propiedades con cambio de estado deben tener 2 logs
        estado_correcto_logs = True
        for prop in propiedades:
            logs_count = len(logs_por_propiedad.get(prop.id, []))
            estado_prop = prop.estado or "Sin Estado"
            expected_logs = 2 if estado_prop != 'Recibida' else 1
            
            if logs_count != expected_logs:
                print(f"❌ {prop.nombre} (ID: {prop.id}) tiene {logs_count} logs, esperados: {expected_logs}")
                estado_correcto_logs = False
        
        if estado_correcto_logs:
            print(f"✅ Todas las propiedades tienen el número correcto de logs")
        
        print(f"\n🎉 Verificación completada!")

if __name__ == "__main__":
    main()