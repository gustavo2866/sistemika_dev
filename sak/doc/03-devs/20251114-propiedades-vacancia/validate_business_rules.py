"""
Script para validar y corregir reglas de negocio
- Todas las propiedades deben tener al menos una vacancia
- Propiedades con vacancias activas deben estar en estado 1-recibida, 2-en_reparacion o 3-disponible
- Propiedades sin vacancias activas deben estar en estado 4-alquilada o 5-retirada
- El estado debe ser consistente con la última fecha registrada en la vacancia
"""
import sys
import os

# Agregar el directorio backend al path
backend_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')
sys.path.insert(0, os.path.abspath(backend_path))

from app.db import engine
from sqlmodel import text
from datetime import datetime

def verify_all_props_have_vacancias():
    """Verificar que todas las propiedades tengan al menos una vacancia"""
    print("\n" + "="*70)
    print("  1. VERIFICANDO: TODAS LAS PROPIEDADES TIENEN VACANCIAS")
    print("="*70)
    
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT p.id, p.nombre, p.estado
            FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id AND v.deleted_at IS NULL
            WHERE v.id IS NULL AND p.deleted_at IS NULL
        """))
        
        sin_vacancias = list(result)
        
        if sin_vacancias:
            print(f"❌ Propiedades sin vacancias: {len(sin_vacancias)}")
            for row in sin_vacancias:
                print(f"   - ID {row.id}: {row.nombre} (Estado: {row.estado})")
            return False
        else:
            print("✅ Todas las propiedades tienen al menos una vacancia")
            return True

def verify_active_vacancia_states():
    """Verificar que propiedades con vacancias activas tengan estado correcto"""
    print("\n" + "="*70)
    print("  2. VERIFICANDO: PROPIEDADES CON VACANCIAS ACTIVAS")
    print("="*70)
    
    with engine.connect() as conn:
        # Propiedades con vacancia activa pero estado incorrecto
        result = conn.execute(text("""
            SELECT p.id, p.nombre, p.estado, p.estado_fecha,
                   v.id as vac_id, v.fecha_recibida, v.fecha_en_reparacion, 
                   v.fecha_disponible, v.fecha_alquilada, v.fecha_retirada
            FROM propiedades p
            INNER JOIN vacancias v ON p.id = v.propiedad_id
            WHERE v.ciclo_activo = true
              AND p.estado NOT IN ('1-recibida', '2-en_reparacion', '3-disponible')
              AND p.deleted_at IS NULL
              AND v.deleted_at IS NULL
        """))
        
        incorrectos = list(result)
        
        if incorrectos:
            print(f"❌ Propiedades con vacancia activa en estado incorrecto: {len(incorrectos)}")
            for row in incorrectos:
                print(f"\n   Propiedad ID {row.id}: {row.nombre}")
                print(f"   Estado actual: {row.estado} ❌")
                print(f"   Vacancia ID: {row.vac_id}")
                
                # Determinar estado correcto según fechas
                if row.fecha_disponible:
                    estado_sugerido = "3-disponible"
                    fecha_sugerida = row.fecha_disponible
                elif row.fecha_en_reparacion:
                    estado_sugerido = "2-en_reparacion"
                    fecha_sugerida = row.fecha_en_reparacion
                elif row.fecha_recibida:
                    estado_sugerido = "1-recibida"
                    fecha_sugerida = row.fecha_recibida
                else:
                    estado_sugerido = "1-recibida"
                    fecha_sugerida = datetime.now()
                
                print(f"   Estado sugerido: {estado_sugerido} ✓")
                print(f"   Fecha sugerida: {fecha_sugerida}")
            
            return False, incorrectos
        else:
            print("✅ Todas las propiedades con vacancia activa tienen estado correcto")
            print("   (1-recibida, 2-en_reparacion o 3-disponible)")
            return True, []

def verify_inactive_vacancia_states():
    """Verificar que propiedades sin vacancias activas tengan estado correcto"""
    print("\n" + "="*70)
    print("  3. VERIFICANDO: PROPIEDADES SIN VACANCIAS ACTIVAS")
    print("="*70)
    
    with engine.connect() as conn:
        # Propiedades sin vacancia activa
        result = conn.execute(text("""
            SELECT p.id, p.nombre, p.estado, p.estado_fecha,
                   v.id as vac_id, v.fecha_alquilada, v.fecha_retirada
            FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id 
                AND v.deleted_at IS NULL
                AND v.ciclo_activo = false
            WHERE p.id NOT IN (
                SELECT DISTINCT propiedad_id 
                FROM vacancias 
                WHERE ciclo_activo = true AND deleted_at IS NULL
            )
            AND p.deleted_at IS NULL
            AND p.estado NOT IN ('4-alquilada', '5-retirada')
        """))
        
        incorrectos = list(result)
        
        if incorrectos:
            print(f"❌ Propiedades sin vacancia activa en estado incorrecto: {len(incorrectos)}")
            for row in incorrectos:
                print(f"\n   Propiedad ID {row.id}: {row.nombre}")
                print(f"   Estado actual: {row.estado} ❌")
                print(f"   Debe estar en: 4-alquilada o 5-retirada ✓")
                
                # Determinar estado correcto según última vacancia
                if row.vac_id and row.fecha_retirada:
                    estado_sugerido = "5-retirada"
                    fecha_sugerida = row.fecha_retirada
                elif row.vac_id and row.fecha_alquilada:
                    estado_sugerido = "4-alquilada"
                    fecha_sugerida = row.fecha_alquilada
                else:
                    estado_sugerido = "4-alquilada"
                    fecha_sugerida = datetime.now()
                
                print(f"   Estado sugerido: {estado_sugerido}")
                print(f"   Fecha sugerida: {fecha_sugerida}")
            
            return False, incorrectos
        else:
            print("✅ Todas las propiedades sin vacancia activa tienen estado correcto")
            print("   (4-alquilada o 5-retirada)")
            return True, []

def fix_active_vacancia_states(incorrectos):
    """Corregir estados de propiedades con vacancias activas"""
    print("\n" + "="*70)
    print("  CORRIGIENDO: PROPIEDADES CON VACANCIAS ACTIVAS")
    print("="*70)
    
    if not incorrectos:
        print("✓ No hay correcciones necesarias")
        return
    
    with engine.connect() as conn:
        corregidos = 0
        
        for row in incorrectos:
            # Determinar estado correcto según fechas
            if row.fecha_disponible:
                nuevo_estado = "3-disponible"
                nueva_fecha = row.fecha_disponible
            elif row.fecha_en_reparacion:
                nuevo_estado = "2-en_reparacion"
                nueva_fecha = row.fecha_en_reparacion
            elif row.fecha_recibida:
                nuevo_estado = "1-recibida"
                nueva_fecha = row.fecha_recibida
            else:
                nuevo_estado = "1-recibida"
                nueva_fecha = datetime.now()
            
            print(f"\n  Propiedad ID {row.id}: {row.nombre}")
            print(f"    {row.estado} → {nuevo_estado}")
            print(f"    Fecha: {nueva_fecha}")
            
            conn.execute(text("""
                UPDATE propiedades 
                SET estado = :nuevo_estado,
                    estado_fecha = :nueva_fecha
                WHERE id = :prop_id
            """), {
                "nuevo_estado": nuevo_estado,
                "nueva_fecha": nueva_fecha,
                "prop_id": row.id
            })
            
            corregidos += 1
        
        conn.commit()
        print(f"\n✅ {corregidos} propiedades corregidas")

def fix_inactive_vacancia_states(incorrectos):
    """Corregir estados de propiedades sin vacancias activas"""
    print("\n" + "="*70)
    print("  CORRIGIENDO: PROPIEDADES SIN VACANCIAS ACTIVAS")
    print("="*70)
    
    if not incorrectos:
        print("✓ No hay correcciones necesarias")
        return
    
    with engine.connect() as conn:
        corregidos = 0
        
        for row in incorrectos:
            # Obtener la última vacancia de esta propiedad
            result = conn.execute(text("""
                SELECT fecha_retirada, fecha_alquilada
                FROM vacancias
                WHERE propiedad_id = :prop_id AND deleted_at IS NULL
                ORDER BY id DESC
                LIMIT 1
            """), {"prop_id": row.id})
            
            vac = result.first()
            
            if vac and vac.fecha_retirada:
                nuevo_estado = "5-retirada"
                nueva_fecha = vac.fecha_retirada
            elif vac and vac.fecha_alquilada:
                nuevo_estado = "4-alquilada"
                nueva_fecha = vac.fecha_alquilada
            else:
                nuevo_estado = "4-alquilada"
                nueva_fecha = datetime.now()
            
            print(f"\n  Propiedad ID {row.id}: {row.nombre}")
            print(f"    {row.estado} → {nuevo_estado}")
            print(f"    Fecha: {nueva_fecha}")
            
            conn.execute(text("""
                UPDATE propiedades 
                SET estado = :nuevo_estado,
                    estado_fecha = :nueva_fecha
                WHERE id = :prop_id
            """), {
                "nuevo_estado": nuevo_estado,
                "nueva_fecha": nueva_fecha,
                "prop_id": row.id
            })
            
            corregidos += 1
        
        conn.commit()
        print(f"\n✅ {corregidos} propiedades corregidas")

def verify_estado_fecha_consistency():
    """Verificar que el estado sea consistente con la última fecha de la vacancia"""
    print("\n" + "="*70)
    print("  4. VERIFICANDO: CONSISTENCIA ESTADO VS FECHAS")
    print("="*70)
    
    with engine.connect() as conn:
        # Verificar consistencia completa
        result = conn.execute(text("""
            WITH ultima_fecha AS (
                SELECT 
                    v.propiedad_id,
                    p.estado,
                    p.estado_fecha,
                    v.fecha_recibida,
                    v.fecha_en_reparacion,
                    v.fecha_disponible,
                    v.fecha_alquilada,
                    v.fecha_retirada,
                    GREATEST(
                        COALESCE(v.fecha_retirada, '1900-01-01'::timestamp),
                        COALESCE(v.fecha_alquilada, '1900-01-01'::timestamp),
                        COALESCE(v.fecha_disponible, '1900-01-01'::timestamp),
                        COALESCE(v.fecha_en_reparacion, '1900-01-01'::timestamp),
                        COALESCE(v.fecha_recibida, '1900-01-01'::timestamp)
                    ) as ultima_fecha_real
                FROM vacancias v
                INNER JOIN propiedades p ON v.propiedad_id = p.id
                WHERE (v.ciclo_activo = true OR v.id IN (
                    SELECT id FROM vacancias v2 
                    WHERE v2.propiedad_id = p.id 
                    AND v2.deleted_at IS NULL 
                    ORDER BY v2.id DESC LIMIT 1
                ))
                AND v.deleted_at IS NULL
                AND p.deleted_at IS NULL
            )
            SELECT 
                uf.propiedad_id,
                p.nombre,
                uf.estado,
                uf.estado_fecha,
                uf.ultima_fecha_real,
                CASE 
                    WHEN uf.ultima_fecha_real = uf.fecha_retirada THEN '5-retirada'
                    WHEN uf.ultima_fecha_real = uf.fecha_alquilada THEN '4-alquilada'
                    WHEN uf.ultima_fecha_real = uf.fecha_disponible THEN '3-disponible'
                    WHEN uf.ultima_fecha_real = uf.fecha_en_reparacion THEN '2-en_reparacion'
                    WHEN uf.ultima_fecha_real = uf.fecha_recibida THEN '1-recibida'
                END as estado_esperado
            FROM ultima_fecha uf
            INNER JOIN propiedades p ON uf.propiedad_id = p.id
            WHERE uf.estado != CASE 
                    WHEN uf.ultima_fecha_real = uf.fecha_retirada THEN '5-retirada'
                    WHEN uf.ultima_fecha_real = uf.fecha_alquilada THEN '4-alquilada'
                    WHEN uf.ultima_fecha_real = uf.fecha_disponible THEN '3-disponible'
                    WHEN uf.ultima_fecha_real = uf.fecha_en_reparacion THEN '2-en_reparacion'
                    WHEN uf.ultima_fecha_real = uf.fecha_recibida THEN '1-recibida'
                END
        """))
        
        inconsistentes = list(result)
        
        if inconsistentes:
            print(f"❌ Propiedades con estado inconsistente con fechas: {len(inconsistentes)}")
            for row in inconsistentes[:10]:
                print(f"\n   Propiedad ID {row.propiedad_id}: {row.nombre}")
                print(f"   Estado actual: {row.estado}")
                print(f"   Estado esperado: {row.estado_esperado}")
                print(f"   Última fecha: {row.ultima_fecha_real}")
            
            if len(inconsistentes) > 10:
                print(f"\n   ... y {len(inconsistentes) - 10} más")
            
            return False, inconsistentes
        else:
            print("✅ Todos los estados son consistentes con las fechas de vacancias")
            return True, []

def fix_estado_fecha_consistency(inconsistentes):
    """Corregir estados inconsistentes con fechas"""
    print("\n" + "="*70)
    print("  CORRIGIENDO: ESTADOS INCONSISTENTES CON FECHAS")
    print("="*70)
    
    if not inconsistentes:
        print("✓ No hay correcciones necesarias")
        return
    
    with engine.connect() as conn:
        corregidos = 0
        
        for row in inconsistentes:
            print(f"\n  Propiedad ID {row.propiedad_id}: {row.nombre}")
            print(f"    {row.estado} → {row.estado_esperado}")
            print(f"    Fecha: {row.ultima_fecha_real}")
            
            conn.execute(text("""
                UPDATE propiedades 
                SET estado = :nuevo_estado,
                    estado_fecha = :nueva_fecha
                WHERE id = :prop_id
            """), {
                "nuevo_estado": row.estado_esperado,
                "nueva_fecha": row.ultima_fecha_real,
                "prop_id": row.propiedad_id
            })
            
            corregidos += 1
        
        conn.commit()
        print(f"\n✅ {corregidos} propiedades corregidas")

def main():
    print("="*70)
    print("  VALIDACIÓN Y CORRECCIÓN DE REGLAS DE NEGOCIO")
    print("  Propiedades y Vacancias")
    print("="*70)
    print(f"\nFecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    print("\n📋 REGLAS DE NEGOCIO:")
    print("  1. Todas las propiedades deben tener al menos una vacancia")
    print("  2. Propiedades con vacancias activas: estados 1, 2 o 3")
    print("  3. Propiedades sin vacancias activas: estados 4 o 5")
    print("  4. Estado debe ser consistente con la última fecha registrada")
    
    try:
        # Verificaciones
        check1 = verify_all_props_have_vacancias()
        check2, incorrectos_activos = verify_active_vacancia_states()
        check3, incorrectos_inactivos = verify_inactive_vacancia_states()
        check4, inconsistentes = verify_estado_fecha_consistency()
        
        # Aplicar correcciones si hay problemas
        if not check2:
            fix_active_vacancia_states(incorrectos_activos)
        
        if not check3:
            fix_inactive_vacancia_states(incorrectos_inactivos)
        
        if not check4:
            fix_estado_fecha_consistency(inconsistentes)
        
        # Verificación final
        if not check2 or not check3 or not check4:
            print("\n" + "="*70)
            print("  VERIFICACIÓN FINAL")
            print("="*70)
            verify_all_props_have_vacancias()
            verify_active_vacancia_states()
            verify_inactive_vacancia_states()
            verify_estado_fecha_consistency()
        
        print("\n" + "="*70)
        print("  ✅ VALIDACIÓN COMPLETADA")
        print("="*70 + "\n")
        
    except Exception as e:
        print("\n" + "="*70)
        print("  ❌ ERROR EN LA VALIDACIÓN")
        print("="*70)
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
