"""
Script para identificar propiedades en estado 'realizada' que tienen vacancia activa.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
load_dotenv()

# Agregar backend al path
backend_path = Path(__file__).parent
sys.path.append(str(backend_path))

from sqlalchemy import create_engine, text
from sqlmodel import Session

def main():
    """Analiza propiedades con estado realizada y vacancia activa."""
    
    print("Analizando inconsistencia: Propiedades 'realizada' con vacancia activa")
    print("=" * 70)
    
    # Obtener DATABASE_URL del archivo .env
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: No se encontro DATABASE_URL en variables de entorno")
        print("Verifica que el archivo .env exista y contenga DATABASE_URL")
        return
    
    print(f"Conectando a base de datos...")
    print(f"URL (parcial): {database_url[:30]}...")
    
    # Crear conexión a base de datos
    try:
        engine = create_engine(database_url)
        print("Conexion establecida exitosamente")
    except Exception as e:
        print(f"Error conectando a base de datos: {e}")
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
                p.estado_comentario
            FROM propiedades p
            WHERE p.estado = '4-realizada' 
            AND p.vacancia_activa = true
            ORDER BY p.id;
            """
            
            print("Ejecutando consulta...")
            result = session.execute(text(query))
            rows = result.fetchall()
            
            if not rows:
                print(">>> No se encontraron propiedades en estado 'realizada' con vacancia activa.")
                
                # Veamos estadisticas generales
                query_stats = """
                SELECT 
                    COUNT(*) as total_realizada,
                    COUNT(CASE WHEN vacancia_activa = true THEN 1 END) as con_vacancia_activa,
                    COUNT(CASE WHEN vacancia_activa = false THEN 1 END) as sin_vacancia_activa
                FROM propiedades 
                WHERE estado = '4-realizada'
                """
                result_stats = session.execute(text(query_stats))
                stats = result_stats.fetchone()
                
                print(f"\nESTADISTICAS:")
                print(f"Total propiedades realizadas: {stats.total_realizada}")
                print(f"Con vacancia_activa=true: {stats.con_vacancia_activa}")  
                print(f"Con vacancia_activa=false: {stats.sin_vacancia_activa}")
                
                if stats.total_realizada == 0:
                    print("\n>>> No hay propiedades en estado '4-realizada'")
                    print("Verificando otros estados...")
                    
                    query_estados = """
                    SELECT estado, COUNT(*) as cantidad
                    FROM propiedades 
                    WHERE estado LIKE '%realizada%' OR estado LIKE '%Realizada%'
                    GROUP BY estado
                    ORDER BY cantidad DESC;
                    """
                    result_estados = session.execute(text(query_estados))
                    estados = result_estados.fetchall()
                    
                    if estados:
                        print("Estados similares encontrados:")
                        for estado in estados:
                            print(f"  {estado.estado}: {estado.cantidad}")
                    else:
                        print("No se encontraron estados similares a 'realizada'")
                return
            
            print(f">>> ENCONTRADAS {len(rows)} propiedades con inconsistencia:")
            print()
            
            for i, row in enumerate(rows, 1):
                print(f"#{i} - ID: {row.id}")
                print(f"    Nombre: {row.nombre or 'Sin nombre'}")
                print(f"    Estado: {row.estado}")
                print(f"    Fecha estado: {row.estado_fecha}")
                print(f"    Comentario: {row.estado_comentario or 'Sin comentario'}")
                print(f"    Vacancia activa: {row.vacancia_activa}")
                print(f"    Fecha vacancia: {row.vacancia_fecha}")
                print("-" * 60)
            
            # Consulta adicional para ver info de vacancias
            query_vacancias = """
            SELECT 
                p.id,
                p.nombre,
                v.id as vacancia_id,
                v.ciclo_activo,
                v.fecha_disponible,
                v.fecha_alquilada
            FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id AND v.ciclo_activo = true
            WHERE p.estado = '4-realizada' 
            AND p.vacancia_activa = true;
            """
            
            print("\nINFORMACION DE VACANCIAS ASOCIADAS:")
            result_vac = session.execute(text(query_vacancias))
            vac_rows = result_vac.fetchall()
            
            for row in vac_rows:
                print(f"Propiedad {row.id}: Vacancia ID {row.vacancia_id}, Ciclo activo: {row.ciclo_activo}")
            
            print("\n" + "="*50)
            print("RECOMENDACIONES:")
            print("1. Revisar si estas propiedades realmente estan alquiladas/vendidas")
            print("2. Si estan alquiladas, cambiar vacancia_activa = false")
            print("3. Si estan alquiladas, cerrar el ciclo en tabla vacancias")

    except Exception as e:
        print(f"Error ejecutando consultas: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()