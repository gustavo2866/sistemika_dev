"""
Reporte final de validación de reglas de negocio
"""
import sys
import os

backend_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')
sys.path.insert(0, os.path.abspath(backend_path))

from app.db import engine
from sqlmodel import text

def main():
    with engine.connect() as conn:
        print("\n" + "="*70)
        print("  REPORTE FINAL - VALIDACIÓN DE REGLAS DE NEGOCIO")
        print("="*70)
        
        # Conteo general
        result = conn.execute(text("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN id IN (
                    SELECT DISTINCT propiedad_id 
                    FROM vacancias 
                    WHERE ciclo_activo=true AND deleted_at IS NULL
                ) THEN 1 ELSE 0 END) as con_vac_activa
            FROM propiedades 
            WHERE deleted_at IS NULL
        """))
        
        row = result.first()
        print(f"\n📊 TOTALES:")
        print(f"   Total propiedades: {row.total}")
        print(f"   Con vacancia activa: {row.con_vac_activa}")
        print(f"   Sin vacancia activa: {row.total - row.con_vac_activa}")
        
        # Desglose por estado
        result = conn.execute(text("""
            SELECT 
                estado,
                COUNT(*) as cant,
                SUM(CASE WHEN id IN (
                    SELECT propiedad_id 
                    FROM vacancias 
                    WHERE ciclo_activo=true AND deleted_at IS NULL
                ) THEN 1 ELSE 0 END) as con_activa
            FROM propiedades 
            WHERE deleted_at IS NULL
            GROUP BY estado
            ORDER BY estado
        """))
        
        print("\n📋 VALIDACIÓN POR ESTADO:")
        print("-" * 70)
        print(f"{'Estado':<22} {'Total':>6} {'Con Activa':>11} {'Sin Activa':>11}  Status")
        print("-" * 70)
        
        all_valid = True
        for r in result:
            sin_activa = r.cant - r.con_activa
            
            # Validar según reglas de negocio
            if r.estado in ['1-recibida', '2-en_reparacion', '3-disponible']:
                # Deben tener vacancia activa
                is_valid = (r.con_activa == r.cant)
                check = '✅' if is_valid else '❌'
                if not is_valid:
                    all_valid = False
            elif r.estado in ['4-alquilada', '5-retirada']:
                # NO deben tener vacancia activa
                is_valid = (sin_activa == r.cant)
                check = '✅' if is_valid else '❌'
                if not is_valid:
                    all_valid = False
            else:
                check = '⚠️'
                all_valid = False
            
            print(f"{r.estado:<22} {r.cant:>6} {r.con_activa:>11} {sin_activa:>11}   {check}")
        
        print("-" * 70)
        
        # Validación de todas las propiedades tienen vacancias
        result = conn.execute(text("""
            SELECT COUNT(*) FROM propiedades p
            WHERE p.deleted_at IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM vacancias v 
                WHERE v.propiedad_id = p.id AND v.deleted_at IS NULL
              )
        """))
        sin_vacancias = result.scalar()
        
        print("\n✅ REGLAS DE NEGOCIO:")
        print(f"   [{'✅' if sin_vacancias == 0 else '❌'}] Todas las propiedades tienen al menos una vacancia")
        print(f"   [{'✅' if all_valid else '❌'}] Estados consistentes con vacancias activas")
        
        # Resumen final
        result = conn.execute(text("""
            SELECT 
                p.estado,
                v.ciclo_activo,
                COUNT(*) as cantidad
            FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id AND v.deleted_at IS NULL
            WHERE p.deleted_at IS NULL
            GROUP BY p.estado, v.ciclo_activo
            ORDER BY p.estado, v.ciclo_activo DESC
        """))
        
        print("\n📈 MATRIZ ESTADO vs CICLO ACTIVO:")
        print("-" * 70)
        
        estados = {}
        for r in result:
            if r.estado not in estados:
                estados[r.estado] = {'activo': 0, 'inactivo': 0}
            
            if r.ciclo_activo is True:
                estados[r.estado]['activo'] = r.cantidad
            elif r.ciclo_activo is False:
                estados[r.estado]['inactivo'] = r.cantidad
        
        print(f"{'Estado':<22} {'Vac. Activa':>12} {'Vac. Inactiva':>14}")
        print("-" * 70)
        
        for estado in sorted(estados.keys()):
            activo = estados[estado]['activo']
            inactivo = estados[estado]['inactivo']
            print(f"{estado:<22} {activo:>12} {inactivo:>14}")
        
        print("\n" + "="*70)
        if all_valid and sin_vacancias == 0:
            print("  ✅ TODAS LAS REGLAS DE NEGOCIO SE CUMPLEN")
        else:
            print("  ⚠️  HAY REGLAS DE NEGOCIO QUE NO SE CUMPLEN")
        print("="*70 + "\n")

if __name__ == "__main__":
    main()
