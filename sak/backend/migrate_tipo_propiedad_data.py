"""
Script para migrar datos del campo 'tipo' string al FK tipo_propiedad_id.

Este script:
1. Extrae todos los tipos únicos del campo 'tipo' en propiedades
2. Crea registros en la tabla tipos_propiedad para tipos que no existan
3. Actualiza todas las propiedades para asignar el tipo_propiedad_id correcto
4. Opcionalmente, puede limpiar el campo 'tipo' string después de la migración
"""

import os
from sqlalchemy import create_engine, text
from sqlmodel import Session
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def main() -> None:
    print("Migrando datos de 'tipo' string a FK tipo_propiedad_id")
    print("=" * 60)

    if not DATABASE_URL:
        print("Error: DATABASE_URL no configurada")
        return

    try:
        engine = create_engine(DATABASE_URL)
        print("Conexión a base de datos establecida")
    except Exception as exc:
        print(f"Error conectando a base de datos: {exc}")
        return

    try:
        with Session(engine) as session:
            # 1. Verificar estado actual
            print("\n1. ANÁLISIS INICIAL:")
            print("-" * 40)
            
            # Contar propiedades sin tipo_propiedad_id
            result = session.execute(text("""
                SELECT COUNT(*) as total_propiedades,
                       COUNT(CASE WHEN tipo_propiedad_id IS NULL THEN 1 END) as sin_fk,
                       COUNT(CASE WHEN tipo_propiedad_id IS NOT NULL THEN 1 END) as con_fk
                FROM propiedades;
            """))
            stats = result.fetchone()
            
            print(f"Total propiedades: {stats.total_propiedades}")
            print(f"Sin FK (requiere migración): {stats.sin_fk}")
            print(f"Ya con FK: {stats.con_fk}")
            
            if stats.sin_fk == 0:
                print("✅ Todas las propiedades ya tienen tipo_propiedad_id asignado.")
                return
            
            # 2. Obtener tipos únicos del campo 'tipo'
            print("\\n2. TIPOS ÚNICOS EN PROPIEDADES:")
            print("-" * 40)
            
            result = session.execute(text("""
                SELECT DISTINCT tipo, COUNT(*) as cantidad
                FROM propiedades 
                WHERE tipo_propiedad_id IS NULL
                GROUP BY tipo
                ORDER BY cantidad DESC;
            """))
            tipos_existentes = result.fetchall()
            
            if not tipos_existentes:
                print("No se encontraron tipos para migrar.")
                return
            
            for tipo in tipos_existentes:
                print(f"  {tipo.tipo}: {tipo.cantidad} propiedades")
            
            # 3. Verificar qué tipos ya existen en tipos_propiedad
            print("\\n3. VERIFICANDO CATÁLOGO TIPOS_PROPIEDAD:")
            print("-" * 40)
            
            result = session.execute(text("""
                SELECT nombre, id FROM tipos_propiedad ORDER BY nombre;
            """))
            tipos_catalogados = result.fetchall()
            
            print(f"Tipos ya catalogados: {len(tipos_catalogados)}")
            for tipo in tipos_catalogados:
                print(f"  ID {tipo.id}: {tipo.nombre}")
            
            # 4. Identificar tipos nuevos que necesitan ser creados
            tipos_catalogados_nombres = {t.nombre for t in tipos_catalogados}
            tipos_propiedades_nombres = {t.tipo for t in tipos_existentes}
            tipos_nuevos = tipos_propiedades_nombres - tipos_catalogados_nombres
            
            print(f"\\nTipos nuevos a crear: {len(tipos_nuevos)}")
            for tipo in tipos_nuevos:
                print(f"  - {tipo}")
            
            # Confirmar antes de proceder
            print("\\n" + "="*50)
            print("ACCIONES A REALIZAR:")
            print(f"1. Crear {len(tipos_nuevos)} nuevos tipos en tipos_propiedad")
            print(f"2. Actualizar {stats.sin_fk} propiedades con tipo_propiedad_id")
            print("="*50)
            
            respuesta = input("\\n¿Proceder con la migración? (si/no): ").lower().strip()
            if respuesta not in ['si', 's', 'yes', 'y']:
                print("Operación cancelada.")
                return
            
            # 5. Crear tipos nuevos en tipos_propiedad
            tipos_creados = 0
            if tipos_nuevos:
                print(f"\\n4. CREANDO {len(tipos_nuevos)} TIPOS NUEVOS:")
                print("-" * 40)
                
                for tipo_nombre in tipos_nuevos:
                    try:
                        result = session.execute(text("""
                            INSERT INTO tipos_propiedad (nombre, descripcion, activo, created_at, updated_at)
                            VALUES (:nombre, :descripcion, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            RETURNING id;
                        """), {
                            "nombre": tipo_nombre,
                            "descripcion": f"Tipo migrado automáticamente: {tipo_nombre}"
                        })
                        nuevo_id = result.fetchone().id
                        tipos_creados += 1
                        print(f"✓ Creado: {tipo_nombre} (ID: {nuevo_id})")
                    
                    except Exception as e:
                        print(f"✗ Error creando {tipo_nombre}: {e}")
                        session.rollback()
                        raise
            
            # 6. Actualizar propiedades con los FK correctos
            print(f"\\n5. ACTUALIZANDO {stats.sin_fk} PROPIEDADES:")
            print("-" * 40)
            
            propiedades_actualizadas = 0
            for tipo in tipos_existentes:
                try:
                    # Obtener el ID del tipo
                    result = session.execute(text("""
                        SELECT id FROM tipos_propiedad WHERE nombre = :nombre LIMIT 1;
                    """), {"nombre": tipo.tipo})
                    
                    tipo_row = result.fetchone()
                    if not tipo_row:
                        print(f"✗ No se encontró ID para tipo: {tipo.tipo}")
                        continue
                    
                    tipo_id = tipo_row.id
                    
                    # Actualizar propiedades
                    result = session.execute(text("""
                        UPDATE propiedades 
                        SET tipo_propiedad_id = :tipo_id,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE tipo = :tipo_nombre 
                        AND tipo_propiedad_id IS NULL;
                    """), {
                        "tipo_id": tipo_id,
                        "tipo_nombre": tipo.tipo
                    })
                    
                    actualizadas = result.rowcount
                    propiedades_actualizadas += actualizadas
                    print(f"✓ {tipo.tipo} (ID: {tipo_id}): {actualizadas} propiedades actualizadas")
                
                except Exception as e:
                    print(f"✗ Error actualizando propiedades con tipo {tipo.tipo}: {e}")
                    session.rollback()
                    raise
            
            # Confirmar cambios
            session.commit()
            
            print("\\n" + "="*50)
            print("MIGRACIÓN COMPLETADA:")
            print(f"- Tipos creados: {tipos_creados}")
            print(f"- Propiedades actualizadas: {propiedades_actualizadas}")
            print("="*50)
            
            # Verificar resultado final
            print("\\nVerificando resultado...")
            result = session.execute(text("""
                SELECT COUNT(*) as sin_fk
                FROM propiedades 
                WHERE tipo_propiedad_id IS NULL;
            """))
            
            restantes = result.fetchone().sin_fk
            if restantes == 0:
                print("✅ Todas las propiedades ahora tienen tipo_propiedad_id asignado.")
            else:
                print(f"⚠ Quedan {restantes} propiedades sin FK para revisar.")
            
            # Mostrar estadísticas finales
            print("\\nESTADÍSTICAS FINALES:")
            result = session.execute(text("""
                SELECT tp.nombre, COUNT(p.id) as cantidad
                FROM tipos_propiedad tp
                LEFT JOIN propiedades p ON tp.id = p.tipo_propiedad_id
                GROUP BY tp.id, tp.nombre
                ORDER BY cantidad DESC, tp.nombre;
            """))
            
            stats_finales = result.fetchall()
            for stat in stats_finales:
                print(f"  {stat.nombre}: {stat.cantidad} propiedades")

    except Exception as e:
        print(f"Error durante la migración: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()