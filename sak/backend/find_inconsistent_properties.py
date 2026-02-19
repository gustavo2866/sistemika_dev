"""
Script para identificar propiedades en estado 'realizada' que tienen vacancia activa.
"""

import os
import sys
from pathlib import Path

# Agregar backend al path
backend_path = Path(__file__).parent
sys.path.append(str(backend_path))

from sqlalchemy import create_engine, text
from sqlmodel import Session

# Configuración de base de datos
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sak_dev")

def main():
    """Analiza propiedades con estado realizada y vacancia activa."""
    
    print("Analizando inconsistencia: Propiedades 'realizada' con vacancia activa")
    print("=" * 70)
    
    # Crear conexión a base de datos
    try:
        engine = create_engine(DATABASE_URL)
        print("Conexion a base de datos establecida")
    except Exception as e:
        print(f"Error conectando a base de datos: {e}")
        print("Verifique la variable DATABASE_URL")
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
            
            print("Ejecutando consulta principal...")
            result = session.execute(text(query))
            rows = result.fetchall()
            
            if not rows:
                print(">>> No se encontraron propiedades en estado 'realizada' con vacancia activa.")
                # Veamos si hay propiedades realizadas en general
                query_count = """
                SELECT COUNT(*) as total 
                FROM propiedades 
                WHERE estado = '4-realizada'
                """
                result_count = session.execute(text(query_count))
                total = result_count.fetchone().total
                print(f"Total propiedades en estado '4-realizada': {total}")
                return
            
            print(f">>> ENCONTRADAS {len(rows)} propiedades con inconsistencia:")
            print()
            
            for i, row in enumerate(rows, 1):
                print(f"#{i} - Propiedad ID: {row.id}")
                print(f"    Nombre: {row.nombre}")
                print(f"    Estado: {row.estado}")
                print(f"    Fecha estado: {row.estado_fecha}")
                print(f"    Comentario: {row.estado_comentario or 'Sin comentario'}")
                print(f"    Vacancia activa (campo): {row.vacancia_activa}")
                print(f"    Fecha vacancia: {row.vacancia_fecha}")
                
                if row.vacancia_id:
                    print(f"    Vacancia ID: {row.vacancia_id}")
                    print(f"    Ciclo activo: {row.ciclo_activo}")
                    print(f"    Fecha recibida: {row.fecha_recibida}")
                    print(f"    Fecha disponible: {row.fecha_disponible}")
                    print(f"    Fecha alquilada: {row.fecha_alquilada}")
                    print(f"    Fecha retirada: {row.fecha_retirada}")
                else:
                    print("    *** No tiene vacancia activa en tabla vacancias ***")
                
                print("-" * 60)
            
            # Análisis adicional
            print("\nANALISIS ADICIONAL:")
            print("=" * 50)
            
            query_stats = """
            SELECT 
                COUNT(*) as total_realizada,
                SUM(CASE WHEN p.vacancia_activa = true THEN 1 ELSE 0 END) as con_vacancia_campo,
                SUM(CASE WHEN v.id IS NOT NULL THEN 1 ELSE 0 END) as con_vacancia_tabla
            FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id AND v.ciclo_activo = true
            WHERE p.estado = '4-realizada';
            """
            
            result = session.execute(text(query_stats))
            stats = result.fetchone()
            
            print(f"Total propiedades realizadas: {stats.total_realizada}")
            print(f"Con vacancia_activa=true: {stats.con_vacancia_campo}")
            print(f"Con vacancia activa en tabla: {stats.con_vacancia_tabla}")
            
            print("\nACCIONES SUGERIDAS:")
            print("1. Verificar si estas propiedades realmente estan alquiladas/vendidas")
            print("2. Si estan alquiladas, actualizar vacancia_activa = false")
            print("3. Si estan alquiladas, cerrar ciclo en tabla vacancias")
            print("4. Revisar proceso de cambio de estado para evitar esta inconsistencia")

    except Exception as e:
        print(f"Error ejecutando consultas: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()