"""
Script para ejecutar la migración 022 usando SQL directo
"""
from sqlalchemy import text
from app.db import engine


def execute_migration_022():
    print("\n" + "="*70)
    print("MIGRACIÓN 022: REFACTORIZACIÓN DE EVENTOS")
    print("="*70)
    print("\nEsta migración realizará los siguientes cambios:")
    print("  1. Agregar nuevas columnas: titulo, tipo_evento, resultado")
    print("  2. Migrar datos existentes")
    print("  3. Eliminar columnas antiguas: contacto_id, tipo_id, motivo_id, etc.")
    print("  4. Crear índices nuevos")
    print("\n⚠️  IMPORTANTE: Esta migración es destructiva.")
    print("   Asegúrate de tener un backup de la base de datos.")
    
    respuesta = input("\n¿Deseas continuar? (si/no): ")
    if respuesta.lower() not in ['si', 's', 'yes', 'y']:
        print("Migración cancelada.")
        return
    
    print("\nEjecutando migración...\n")
    
    with engine.begin() as conn:
        try:
            # PASO 1: Agregar nuevas columnas
            print("Paso 1: Agregando nuevas columnas...")
            conn.execute(text("""
                ALTER TABLE crm_eventos 
                ADD COLUMN IF NOT EXISTS titulo VARCHAR(255),
                ADD COLUMN IF NOT EXISTS tipo_evento VARCHAR(20),
                ADD COLUMN IF NOT EXISTS resultado TEXT;
            """))
            print("  ✓ Columnas agregadas\n")
            
            # PASO 2: Migrar datos
            print("Paso 2: Migrando datos existentes...")
            
            # 2.0 Eliminar eventos sin oportunidad_id (datos de prueba)
            result = conn.execute(text("""
                DELETE FROM crm_eventos
                WHERE oportunidad_id IS NULL;
            """))
            print(f"  ✓ Eliminados {result.rowcount} eventos sin oportunidad\n")
            
            # 2.1 Generar título desde descripción
            conn.execute(text("""
                UPDATE crm_eventos
                SET titulo = CASE
                    WHEN descripcion IS NOT NULL AND LENGTH(descripcion) > 0 
                        THEN LEFT(descripcion, 250)
                    ELSE CONCAT('Evento #', id::text)
                END
                WHERE titulo IS NULL;
            """))
            print("  ✓ Títulos generados\n")
            
            # 2.2 Asignar tipo_evento (por defecto 'otro')
            conn.execute(text("""
                UPDATE crm_eventos
                SET tipo_evento = 'otro'
                WHERE tipo_evento IS NULL;
            """))
            print("  ✓ Tipos de evento asignados\n")
            
            # 2.3 Migrar resultado desde descripción y próximo paso
            conn.execute(text("""
                UPDATE crm_eventos
                SET resultado = CONCAT(
                    COALESCE(descripcion, ''),
                    CASE WHEN proximo_paso IS NOT NULL AND proximo_paso != ''
                        THEN CONCAT(E'\\n\\nPróximo paso: ', proximo_paso)
                        ELSE ''
                    END
                )
                WHERE resultado IS NULL;
            """))
            print("  ✓ Resultados migrados\n")
            
            # PASO 3: Establecer columnas como NOT NULL
            print("Paso 3: Aplicando restricciones...")
            conn.execute(text("""
                ALTER TABLE crm_eventos
                ALTER COLUMN titulo SET NOT NULL,
                ALTER COLUMN tipo_evento SET NOT NULL,
                ALTER COLUMN oportunidad_id SET NOT NULL;
            """))
            print("  ✓ Restricciones aplicadas\n")
            
            # PASO 4: Eliminar columnas antiguas
            print("Paso 4: Eliminando columnas antiguas...")
            conn.execute(text("""
                ALTER TABLE crm_eventos
                DROP COLUMN IF EXISTS contacto_id,
                DROP COLUMN IF EXISTS tipo_id,
                DROP COLUMN IF EXISTS motivo_id,
                DROP COLUMN IF EXISTS origen_lead_id,
                DROP COLUMN IF EXISTS proximo_paso,
                DROP COLUMN IF EXISTS fecha_compromiso,
                DROP COLUMN IF EXISTS descripcion;
            """))
            print("  ✓ Columnas eliminadas\n")
            
            # PASO 5: Crear índices
            print("Paso 5: Creando índices...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_crm_eventos_oportunidad 
                ON crm_eventos(oportunidad_id) 
                WHERE deleted_at IS NULL;
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_crm_eventos_tipo 
                ON crm_eventos(tipo_evento) 
                WHERE deleted_at IS NULL;
            """))
            
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_crm_eventos_estado 
                ON crm_eventos(estado_evento) 
                WHERE deleted_at IS NULL;
            """))
            print("  ✓ Índices creados\n")
            
            print("="*70)
            print("✅ MIGRACIÓN COMPLETADA EXITOSAMENTE")
            print("="*70)
            
        except Exception as e:
            print("\n" + "="*70)
            print("❌ ERROR EN LA MIGRACIÓN")
            print("="*70)
            print(f"Error: {e}")
            print("\nLa transacción se revertirá automáticamente.")
            raise


if __name__ == "__main__":
    execute_migration_022()
