"""
Script para identificar propiedades en estado 'realizada' que tienen vacancia activa.

Esta situación puede ser una inconsistencia de datos porque:
- Estado 'realizada' significa que la propiedad fue exitosamente vendida/alquilada
- Vacancia activa significa que la propiedad está en un ciclo de disponibilidad

Esto puede ocurrir si:
1. Se cambió el estado a 'realizada' pero no se cerró la vacancia
2. Hay un problema en el flujo de estados
3. Es un comportamiento legítimo que no está documentado
"""

import os
import sys
from pathlib import Path

# Agregar backend al path para importar módulos
backend_path = Path(__file__).parent
sys.path.append(str(backend_path))

from sqlalchemy import create_engine, text
from sqlmodel import Session
import psycopg2

# Configuración de base de datos (usar variables de entorno o valores por defecto)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sak_dev")

def main():
    """Analiza propiedades con estado realizada y vacancia activa."""
    
    print("🔍 Analizando inconsistencia: Propiedades 'realizada' con vacancia activa")
    print("=" * 70)
    
    # Crear conexión a base de datos
    try:
        engine = create_engine(DATABASE_URL)
    except Exception as e:
        print(f"❌ Error conectando a base de datos: {e}")
        print("💡 Verifique la variable DATABASE_URL")
        return
    
    try:
        with Session(engine) as session:
            # Buscar propiedades en estado realizada con vacancia activa
            query = """
            SELECT 
                p.id,
                p.nombre,
                p.estado,
                p.vacancia_activa,
                p.vacancia_fecha,
                p.estado_fecha,
                p.estado_comentario,
                v.id as vacancia_id,
                v.ciclo_activo,
                v.fecha_recibida,
                v.fecha_disponible,
                v.fecha_alquilada,
                v.fecha_retirada
            FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id AND v.ciclo_activo = true
            WHERE p.estado = '4-realizada' 
            AND p.vacancia_activa = true
            ORDER BY p.id;
            """
            
            result = session.execute(text(query))
            rows = result.fetchall()
            
            if not rows:
                print("✅ No se encontraron propiedades en estado 'realizada' con vacancia activa.")
                return
            
            print(f"⚠️  Se encontraron {len(rows)} propiedades con esta inconsistencia:")
            print()
            
            for row in rows:
                print(f"🏠 Propiedad ID: {row.id}")
                print(f"   Nombre: {row.nombre}")
                print(f"   Estado: {row.estado}")
                print(f"   Fecha estado: {row.estado_fecha}")
                print(f"   Comentario estado: {row.estado_comentario or 'Sin comentario'}")
                print(f"   Vacancia activa: {row.vacancia_activa}")
                print(f"   Fecha vacancia: {row.vacancia_fecha}")
                
                if row.vacancia_id:
                    print(f"   📋 Vacancia ID: {row.vacancia_id}")
                    print(f"   Ciclo activo: {row.ciclo_activo}")
                    print(f"   Fecha recibida: {row.fecha_recibida}")
                    print(f"   Fecha disponible: {row.fecha_disponible}")
                    print(f"   Fecha alquilada: {row.fecha_alquilada}")
                    print(f"   Fecha retirada: {row.fecha_retirada}")
                else:
                    print(f"   ❌ No tiene vacancia activa en tabla vacancias")
                
                print("-" * 50)
            
            # Análisis adicional
            print("\n📊 ANÁLISIS:")
            print("=" * 50)
            
            # ¿Cuántas tienen vacancia activa según campo vs tabla?
            query_field_vs_table = """
            SELECT 
                COUNT(*) as total_realizada,
                SUM(CASE WHEN p.vacancia_activa = true THEN 1 ELSE 0 END) as con_vacancia_campo,
                SUM(CASE WHEN v.id IS NOT NULL THEN 1 ELSE 0 END) as con_vacancia_tabla
            FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id AND v.ciclo_activo = true
            WHERE p.estado = '4-realizada';
            """
            
            result = session.execute(text(query_field_vs_table))
            stats = result.fetchone()
            
            print(f"Total propiedades realizadas: {stats.total_realizada}")
            print(f"Con vacancia_activa=true: {stats.con_vacancia_campo}")
            print(f"Con vacancia activa en tabla: {stats.con_vacancia_tabla}")
            
            # Verificar otras propiedades realizadas
            query_otras_realizadas = """
            SELECT 
                p.id,
                p.nombre,
                p.estado_fecha,
                p.vacancia_activa,
                v.id as vacancia_id
            FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id AND v.ciclo_activo = true
            WHERE p.estado = '4-realizada' 
            AND p.vacancia_activa = false
            ORDER BY p.estado_fecha DESC
            LIMIT 5;
            """
            
            result = session.execute(text(query_otras_realizadas))
            otras = result.fetchall()
            
            print(f"\n📋 Ejemplos de propiedades realizadas SIN vacancia activa:")
            for prop in otras:
                print(f"   ID: {prop.id}, Nombre: {prop.nombre}, Fecha: {prop.estado_fecha}")
            
            print("\n💡 POSIBLES CAUSAS:")
            print("1. La propiedad se marcó como 'realizada' pero no se cerró la vacancia")
            print("2. Error en el flujo de estados - debería haberse cerrado automáticamente")
            print("3. Comportamiento legítimo si 'realizada' no significa alquilada")
            print("4. Inconsistencia entre campo vacancia_activa y tabla vacancias")
            
            print("\n🔧 ACCIONES SUGERIDAS:")
            print("1. Verificar definición exacta del estado 'realizada'")
            print("2. Si está alquilada, cerrar la vacancia (ciclo_activo = false)")
            print("3. Actualizar vacancia_activa = false en propiedades")
            print("4. Implementar validación para prevenir esta inconsistencia")

    except Exception as e:
        print(f"❌ Error ejecutando consultas: {e}")


if __name__ == "__main__":
    main()