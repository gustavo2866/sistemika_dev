"""
Script para corregir inconsistencias en los datos
1. Desactivar vacancias duplicadas (mantener solo la más reciente)
2. Sincronizar estado_fecha con fechas de vacancias
"""
import sys
import os

# Agregar el directorio backend al path
backend_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')
sys.path.insert(0, os.path.abspath(backend_path))

from app.db import engine
from sqlmodel import text
from datetime import datetime

def fix_multiple_active_vacancias():
    """Desactivar vacancias duplicadas, mantener solo la más reciente"""
    print("\n" + "="*70)
    print("  CORRIGIENDO VACANCIAS ACTIVAS DUPLICADAS")
    print("="*70)
    
    with engine.connect() as conn:
        # Obtener propiedades con múltiples vacancias activas
        result = conn.execute(text("""
            SELECT 
                p.id as prop_id,
                p.nombre,
                v.id as vac_id,
                v.created_at
            FROM propiedades p
            INNER JOIN vacancias v ON p.id = v.propiedad_id
            WHERE v.ciclo_activo = true
              AND p.deleted_at IS NULL
              AND v.deleted_at IS NULL
            ORDER BY p.id, v.created_at DESC
        """))
        
        rows = list(result)
        
        # Agrupar por propiedad
        propiedades = {}
        for row in rows:
            if row.prop_id not in propiedades:
                propiedades[row.prop_id] = []
            propiedades[row.prop_id].append(row)
        
        # Identificar propiedades con múltiples vacancias
        to_fix = {pid: vacs for pid, vacs in propiedades.items() if len(vacs) > 1}
        
        if not to_fix:
            print("✓ No hay propiedades con múltiples vacancias activas")
            return
        
        print(f"\nPropiedades a corregir: {len(to_fix)}")
        
        for prop_id, vacancias in to_fix.items():
            print(f"\nPropiedad ID {prop_id}: {vacancias[0].nombre}")
            print(f"  Total vacancias activas: {len(vacancias)}")
            
            # Mantener la más reciente (primera en la lista por ORDER BY created_at DESC)
            keep_vac = vacancias[0]
            print(f"  ✓ Mantener: Vacancia ID {keep_vac.vac_id} (created: {keep_vac.created_at})")
            
            # Desactivar las demás
            for vac in vacancias[1:]:
                print(f"  ✗ Desactivar: Vacancia ID {vac.vac_id} (created: {vac.created_at})")
                conn.execute(text("""
                    UPDATE vacancias 
                    SET ciclo_activo = false 
                    WHERE id = :vac_id
                """), {"vac_id": vac.vac_id})
        
        conn.commit()
        print(f"\n✅ Corrección completada: {len(to_fix)} propiedades corregidas")

def sync_estado_fecha():
    """Sincronizar estado_fecha de propiedades con fechas de vacancias activas"""
    print("\n" + "="*70)
    print("  SINCRONIZANDO ESTADO_FECHA CON VACANCIAS")
    print("="*70)
    
    with engine.connect() as conn:
        # Obtener propiedades con vacancia activa
        result = conn.execute(text("""
            SELECT 
                p.id,
                p.nombre,
                p.estado,
                p.estado_fecha,
                CASE 
                    WHEN p.estado = '1-recibida' THEN v.fecha_recibida
                    WHEN p.estado = '2-en_reparacion' THEN v.fecha_en_reparacion
                    WHEN p.estado = '3-disponible' THEN v.fecha_disponible
                    WHEN p.estado = '4-alquilada' THEN v.fecha_alquilada
                    WHEN p.estado = '5-retirada' THEN v.fecha_retirada
                END as fecha_correcta
            FROM propiedades p
            INNER JOIN vacancias v ON p.id = v.propiedad_id
            WHERE v.ciclo_activo = true
              AND p.deleted_at IS NULL
              AND v.deleted_at IS NULL
              AND p.estado_fecha IS NOT NULL
        """))
        
        rows = list(result)
        actualizadas = 0
        
        print(f"\nPropiedades a verificar: {len(rows)}")
        
        for row in rows:
            if row.fecha_correcta is None:
                continue
                
            # Verificar si hay diferencia
            if row.estado_fecha != row.fecha_correcta:
                diff = abs((row.estado_fecha - row.fecha_correcta).total_seconds())
                
                # Solo actualizar si la diferencia es mayor a 1 segundo
                if diff > 1:
                    print(f"\n  Propiedad ID {row.id}: {row.nombre}")
                    print(f"    Estado: {row.estado}")
                    print(f"    Actual: {row.estado_fecha}")
                    print(f"    Correcta: {row.fecha_correcta}")
                    print(f"    Diferencia: {diff:.0f} segundos")
                    
                    # Actualizar
                    conn.execute(text("""
                        UPDATE propiedades 
                        SET estado_fecha = :fecha_correcta 
                        WHERE id = :prop_id
                    """), {"fecha_correcta": row.fecha_correcta, "prop_id": row.id})
                    
                    actualizadas += 1
        
        if actualizadas > 0:
            conn.commit()
            print(f"\n✅ Sincronización completada: {actualizadas} propiedades actualizadas")
        else:
            print(f"\n✓ No hay diferencias significativas (>1 seg) para corregir")

def verify_fixes():
    """Verificar que las correcciones se aplicaron correctamente"""
    print("\n" + "="*70)
    print("  VERIFICANDO CORRECCIONES")
    print("="*70)
    
    with engine.connect() as conn:
        # Verificar múltiples vacancias activas
        result = conn.execute(text("""
            SELECT COUNT(*) FROM (
                SELECT p.id
                FROM propiedades p
                INNER JOIN vacancias v ON p.id = v.propiedad_id
                WHERE v.ciclo_activo = true
                  AND p.deleted_at IS NULL
                  AND v.deleted_at IS NULL
                GROUP BY p.id
                HAVING COUNT(v.id) > 1
            ) sub
        """))
        
        multiples = result.scalar()
        if multiples == 0:
            print("✅ No hay propiedades con múltiples vacancias activas")
        else:
            print(f"❌ Aún hay {multiples} propiedades con múltiples vacancias activas")
        
        # Verificar sincronización de fechas
        result = conn.execute(text("""
            SELECT COUNT(*) FROM propiedades p
            INNER JOIN vacancias v ON p.id = v.propiedad_id
            WHERE v.ciclo_activo = true
              AND p.deleted_at IS NULL
              AND v.deleted_at IS NULL
              AND p.estado_fecha != CASE 
                    WHEN p.estado = '1-recibida' THEN v.fecha_recibida
                    WHEN p.estado = '2-en_reparacion' THEN v.fecha_en_reparacion
                    WHEN p.estado = '3-disponible' THEN v.fecha_disponible
                    WHEN p.estado = '4-alquilada' THEN v.fecha_alquilada
                    WHEN p.estado = '5-retirada' THEN v.fecha_retirada
                END
        """))
        
        desincronizadas = result.scalar()
        if desincronizadas == 0:
            print("✅ Todas las propiedades tienen estado_fecha sincronizado")
        else:
            print(f"⚠️  {desincronizadas} propiedades con diferencias mínimas (<1 seg)")

def main():
    print("="*70)
    print("  CORRECCIÓN DE INCONSISTENCIAS")
    print("  Propiedades y Vacancias")
    print("="*70)
    print(f"\nFecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        # 1. Corregir vacancias duplicadas
        fix_multiple_active_vacancias()
        
        # 2. Sincronizar estado_fecha
        sync_estado_fecha()
        
        # 3. Verificar correcciones
        verify_fixes()
        
        print("\n" + "="*70)
        print("  ✅ CORRECCIÓN COMPLETADA")
        print("="*70 + "\n")
        
    except Exception as e:
        print("\n" + "="*70)
        print("  ❌ ERROR EN LA CORRECCIÓN")
        print("="*70)
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
