"""
Script para validar la integridad de datos en producción después de las migraciones
"""
from sqlalchemy import create_engine, text

# URL de producción
PRODUCTION_DB = "postgresql+psycopg://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

def run_validation(conn, query, title):
    """Ejecuta una query de validación y muestra los resultados."""
    print(f"📊 {title}")
    print("-" * 80)
    result = conn.execute(text(query))
    rows = result.fetchall()
    columns = result.keys()
    
    if rows:
        # Mostrar resultados en formato tabla
        col_widths = [max(len(str(col)), max(len(str(row[i])) for row in rows)) for i, col in enumerate(columns)]
        
        # Header
        header = " | ".join(str(col).ljust(col_widths[i]) for i, col in enumerate(columns))
        print(header)
        print("-" * len(header))
        
        # Rows
        for row in rows:
            print(" | ".join(str(val).ljust(col_widths[i]) for i, val in enumerate(row)))
    else:
        print("   (Sin resultados)")
    print()
    return rows

def main():
    print("=" * 80)
    print("✅ VALIDACIÓN DE INTEGRIDAD DE DATOS - PRODUCCIÓN")
    print("=" * 80)
    print()
    
    engine = create_engine(PRODUCTION_DB)
    
    try:
        with engine.connect() as conn:
            # 1. Propiedades con fecha de estado faltante
            rows = run_validation(
                conn,
                """
                SELECT COUNT(*) AS sin_estado_fecha
                FROM propiedades
                WHERE estado_fecha IS NULL AND deleted_at IS NULL;
                """,
                "1. Propiedades sin estado_fecha"
            )
            
            if rows and rows[0][0] == 0:
                print("   ✅ Todas las propiedades tienen estado_fecha")
                print()
            else:
                print(f"   ⚠️  HAY {rows[0][0]} PROPIEDADES SIN ESTADO_FECHA")
                print()
            
            # 2. Vacancias huérfanas
            rows = run_validation(
                conn,
                """
                SELECT COUNT(*) AS vacancias_huerfanas
                FROM vacancias v
                LEFT JOIN propiedades p ON v.propiedad_id = p.id
                WHERE p.id IS NULL;
                """,
                "2. Vacancias huérfanas (sin propiedad)"
            )
            
            if rows and rows[0][0] == 0:
                print("   ✅ Todas las vacancias tienen propiedad asociada")
                print()
            else:
                print(f"   ⚠️  HAY {rows[0][0]} VACANCIAS HUÉRFANAS")
                print()
            
            # 3. Distribución de estados de propiedades
            run_validation(
                conn,
                """
                SELECT estado, COUNT(*) AS cantidad
                FROM propiedades
                WHERE deleted_at IS NULL
                GROUP BY estado
                ORDER BY estado;
                """,
                "3. Distribución de estados de propiedades"
            )
            
            # 4. Vacancias activas - muestra de fechas
            run_validation(
                conn,
                """
                SELECT id, propiedad_id,
                       fecha_recibida,
                       fecha_en_reparacion,
                       fecha_disponible,
                       fecha_alquilada,
                       fecha_retirada
                FROM vacancias
                WHERE ciclo_activo = true
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC
                LIMIT 10;
                """,
                "4. Vacancias activas (primeras 10)"
            )
            
            # 5. Últimos cambios en propiedades
            run_validation(
                conn,
                """
                SELECT id, nombre, estado, estado_fecha, updated_at::date as updated
                FROM propiedades
                WHERE deleted_at IS NULL
                ORDER BY updated_at DESC
                LIMIT 10;
                """,
                "5. Últimas propiedades actualizadas"
            )
            
            # 6. Verificar tipos de datos
            print("📊 6. Tipos de datos de columnas clave")
            print("-" * 80)
            result = conn.execute(text("""
                SELECT 
                    table_name, 
                    column_name, 
                    data_type
                FROM information_schema.columns
                WHERE table_name IN ('propiedades', 'vacancias')
                  AND column_name IN ('estado_fecha', 'fecha_recibida', 'fecha_en_reparacion', 
                                      'fecha_disponible', 'fecha_alquilada', 'fecha_retirada')
                ORDER BY table_name, column_name;
            """))
            rows = result.fetchall()
            columns = result.keys()
            
            # Mostrar resultados
            col_widths = [max(len(str(col)), max(len(str(row[i])) for row in rows)) for i, col in enumerate(columns)]
            header = " | ".join(str(col).ljust(col_widths[i]) for i, col in enumerate(columns))
            print(header)
            print("-" * len(header))
            for row in rows:
                print(" | ".join(str(val).ljust(col_widths[i]) for i, val in enumerate(row)))
            print()
            
            # Verificar que todos sean DATE
            all_date = all(row[2] == 'date' for row in rows)
            if all_date:
                print("   ✅ Todas las columnas de fecha son tipo DATE")
            else:
                print("   ⚠️  ALGUNAS COLUMNAS NO SON TIPO DATE")
            print()
            
            print("=" * 80)
            print("✅ VALIDACIÓN COMPLETADA")
            print("=" * 80)
            
    except Exception as e:
        print(f"❌ Error ejecutando validación: {e}")
        raise
    finally:
        engine.dispose()

if __name__ == "__main__":
    main()
