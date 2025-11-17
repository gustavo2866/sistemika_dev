"""
Script para ejecutar el SQL de normalización de fechas en producción
"""
from sqlalchemy import create_engine, text

# URL de producción
PRODUCTION_DB = "postgresql+psycopg://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"

def main():
    print("=" * 80)
    print("🔧 AJUSTAR DATOS EN PRODUCCIÓN - NORMALIZACIÓN DE FECHAS")
    print("=" * 80)
    print()
    
    engine = create_engine(PRODUCTION_DB)
    
    try:
        with engine.begin() as conn:
            # 1. Asegurar que estado_fecha no quede nulo
            print("📝 Actualizando estado_fecha en propiedades...")
            result = conn.execute(text("""
                UPDATE propiedades
                SET estado_fecha = COALESCE(estado_fecha::date, updated_at::date, created_at::date, CURRENT_DATE)
                WHERE estado_fecha IS NULL;
            """))
            print(f"   ✅ {result.rowcount} registros actualizados")
            print()
            
            # 2. Truncar componentes de hora en vacancias
            print("📝 Truncando horas en fechas de vacancias...")
            result = conn.execute(text("""
                UPDATE vacancias
                SET fecha_recibida      = fecha_recibida::date,
                    fecha_en_reparacion = fecha_en_reparacion::date,
                    fecha_disponible    = fecha_disponible::date,
                    fecha_alquilada     = fecha_alquilada::date,
                    fecha_retirada      = fecha_retirada::date
                WHERE fecha_recibida IS NOT NULL
                   OR fecha_en_reparacion IS NOT NULL
                   OR fecha_disponible IS NOT NULL
                   OR fecha_alquilada IS NOT NULL
                   OR fecha_retirada IS NOT NULL;
            """))
            print(f"   ✅ {result.rowcount} registros actualizados")
            print()
            
            # 3. Rellenar fecha_recibida en vacancias activas
            print("📝 Rellenando fecha_recibida en vacancias activas...")
            result = conn.execute(text("""
                UPDATE vacancias
                SET fecha_recibida = COALESCE(created_at::date, CURRENT_DATE)
                WHERE ciclo_activo = true
                  AND fecha_recibida IS NULL;
            """))
            print(f"   ✅ {result.rowcount} registros actualizados")
            print()
            
            print("=" * 80)
            print("✅ NORMALIZACIÓN COMPLETADA EXITOSAMENTE")
            print("=" * 80)
            
    except Exception as e:
        print(f"❌ Error ejecutando normalización: {e}")
        raise
    finally:
        engine.dispose()

if __name__ == "__main__":
    main()
