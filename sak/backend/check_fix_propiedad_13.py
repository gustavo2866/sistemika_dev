#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script simple para verificar propiedad 13 via psycopg2 directo
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import urllib.parse

# Cargar variables de entorno
load_dotenv()

def connect_to_db():
    """Conectar a la base de datos usando psycopg2 directo."""
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ DATABASE_URL no configurada")
        return None
    
    # Parsear la URL de conexión
    if database_url.startswith("postgresql+psycopg://"):
        database_url = database_url.replace("postgresql+psycopg://", "postgresql://")
    
    try:
        # Conectar usando psycopg2 directo
        conn = psycopg2.connect(
            database_url,
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"❌ Error conectando: {e}")
        return None

def main():
    """Verificar estado de propiedad 13."""
    
    print("🔍 Verificando propiedad ID 13")
    print("=" * 40)
    
    conn = connect_to_db()
    if not conn:
        return
    
    try:
        with conn.cursor() as cur:
            # Consultar propiedad 13
            cur.execute("""
                SELECT 
                    id, nombre, estado, vacancia_activa, 
                    vacancia_fecha, estado_fecha, estado_comentario,
                    updated_at
                FROM propiedades 
                WHERE id = 13
            """)
            
            prop = cur.fetchone()
            
            if not prop:
                print("❌ No se encontró propiedad ID 13")
                return
            
            print(f"🏠 Propiedad: {prop['nombre']}")
            print(f"   Estado: {prop['estado']}")
            print(f"   Vacancia activa: {prop['vacancia_activa']}")
            print(f"   Fecha estado: {prop['estado_fecha']}")
            print(f"   Fecha vacancia: {prop['vacancia_fecha']}")
            print(f"   Comentario: {prop['estado_comentario'] or 'Sin comentario'}")
            print(f"   Última actualización: {prop['updated_at']}")
            
            # Verificar vacancias
            cur.execute("""
                SELECT id, ciclo_activo, fecha_recibida, fecha_disponible,
                       fecha_alquilada, fecha_retirada, updated_at
                FROM vacancias 
                WHERE propiedad_id = 13
                ORDER BY id DESC
            """)
            
            vacancias = cur.fetchall()
            print(f"\n📋 Vacancias ({len(vacancias)}):")
            
            for v in vacancias:
                print(f"   ID {v['id']}: Activo={v['ciclo_activo']}")
                print(f"   Recibida: {v['fecha_recibida']}")
                print(f"   Disponible: {v['fecha_disponible']}")
                print(f"   Alquilada: {v['fecha_alquilada']}")
                print(f"   Retirada: {v['fecha_retirada']}")
                print(f"   Actualizada: {v['updated_at']}")
                print("   " + "-" * 25)
            
            # Verificar inconsistencia
            inconsistencia = False
            
            if prop['estado'] == '4-realizada' and prop['vacancia_activa']:
                print("\n⚠️  INCONSISTENCIA DETECTADA:")
                print("   Estado 'realizada' con vacancia_activa=true")
                inconsistencia = True
            
            vacancias_activas = [v for v in vacancias if v['ciclo_activo']]
            if vacancias_activas and prop['estado'] == '4-realizada':
                print(f"\n⚠️  {len(vacancias_activas)} vacancia(s) activa(s) en estado realizada")
                inconsistencia = True
            
            if inconsistencia:
                print("\n🔧 ACCIÓN NECESARIA:")
                print("   Ejecutar script de corrección")
                
                # Mostrar qué haría la corrección
                print("\n📝 CORRECCIÓN PROPUESTA:")
                print(f"   1. Actualizar vacancia_activa = false (ID: {prop['id']})")
                
                for v in vacancias_activas:
                    print(f"   2. Cerrar vacancia ID {v['id']} (ciclo_activo = false)")
                    print(f"      Establecer fecha_alquilada = {prop['estado_fecha']}")
                
                respuesta = input("\n¿Aplicar corrección ahora? (s/n): ").lower().strip()
                if respuesta in ['s', 'si', 'y', 'yes']:
                    aplicar_correccion(conn, prop, vacancias_activas)
                else:
                    print("Corrección no aplicada.")
            else:
                print("\n✅ No hay inconsistencias")
    
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

def aplicar_correccion(conn, prop, vacancias_activas):
    """Aplicar corrección a la inconsistencia."""
    
    try:
        with conn.cursor() as cur:
            # 1. Actualizar propiedad
            cur.execute("""
                UPDATE propiedades 
                SET vacancia_activa = false, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND estado = '4-realizada' AND vacancia_activa = true
            """, (prop['id'],))
            
            if cur.rowcount > 0:
                print(f"✅ Propiedad {prop['id']}: vacancia_activa = false")
            
            # 2. Cerrar vacancias activas
            for v in vacancias_activas:
                cur.execute("""
                    UPDATE vacancias 
                    SET ciclo_activo = false, 
                        fecha_alquilada = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s AND ciclo_activo = true
                """, (prop['estado_fecha'], v['id']))
                
                if cur.rowcount > 0:
                    print(f"✅ Vacancia {v['id']}: ciclo cerrado")
            
            # Confirmar cambios
            conn.commit()
            print("\n✅ Corrección aplicada exitosamente")
            
    except Exception as e:
        conn.rollback()
        print(f"❌ Error aplicando corrección: {e}")

if __name__ == "__main__":
    main()