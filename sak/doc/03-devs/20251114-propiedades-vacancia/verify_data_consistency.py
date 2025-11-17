"""
Script de verificación de consistencia de datos
Verifica propiedades, vacancias, estados y fechas
"""
import sys
import os

# Agregar el directorio backend al path
backend_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')
sys.path.insert(0, os.path.abspath(backend_path))

from app.db import engine
from sqlmodel import text
from datetime import datetime

def print_section(title):
    """Imprimir título de sección"""
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)

def check_basic_counts():
    """Verificar conteos básicos"""
    print_section("1. CONTEOS BÁSICOS")
    
    with engine.connect() as conn:
        # Propiedades
        result = conn.execute(text("SELECT COUNT(*) FROM propiedades WHERE deleted_at IS NULL"))
        total_prop = result.scalar()
        print(f"✓ Total propiedades activas: {total_prop}")
        
        # Vacancias
        result = conn.execute(text("SELECT COUNT(*) FROM vacancias WHERE deleted_at IS NULL"))
        total_vac = result.scalar()
        print(f"✓ Total vacancias activas: {total_vac}")
        
        # Vacancias con ciclo activo
        result = conn.execute(text("""
            SELECT COUNT(*) FROM vacancias 
            WHERE ciclo_activo = true AND deleted_at IS NULL
        """))
        vac_activas = result.scalar()
        print(f"✓ Vacancias con ciclo activo: {vac_activas}")
        
        return total_prop, total_vac, vac_activas

def check_orphan_records():
    """Verificar registros huérfanos"""
    print_section("2. REGISTROS HUÉRFANOS")
    
    with engine.connect() as conn:
        # Vacancias sin propiedad
        result = conn.execute(text("""
            SELECT COUNT(*) FROM vacancias v
            LEFT JOIN propiedades p ON v.propiedad_id = p.id
            WHERE p.id IS NULL AND v.deleted_at IS NULL
        """))
        vac_huerfanas = result.scalar()
        
        if vac_huerfanas > 0:
            print(f"❌ Vacancias sin propiedad: {vac_huerfanas}")
            # Mostrar detalles
            result = conn.execute(text("""
                SELECT v.id, v.propiedad_id 
                FROM vacancias v
                LEFT JOIN propiedades p ON v.propiedad_id = p.id
                WHERE p.id IS NULL AND v.deleted_at IS NULL
                LIMIT 10
            """))
            for row in result:
                print(f"   - Vacancia ID {row.id}: propiedad_id={row.propiedad_id}")
        else:
            print(f"✓ No hay vacancias huérfanas: {vac_huerfanas}")
        
        # Propiedades sin vacancias
        result = conn.execute(text("""
            SELECT COUNT(*) FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id AND v.deleted_at IS NULL
            WHERE v.id IS NULL AND p.deleted_at IS NULL
        """))
        prop_sin_vac = result.scalar()
        
        if prop_sin_vac > 0:
            print(f"⚠️  Propiedades sin vacancias: {prop_sin_vac}")
            result = conn.execute(text("""
                SELECT p.id, p.nombre, p.estado 
                FROM propiedades p
                LEFT JOIN vacancias v ON p.id = v.propiedad_id AND v.deleted_at IS NULL
                WHERE v.id IS NULL AND p.deleted_at IS NULL
                LIMIT 10
            """))
            for row in result:
                print(f"   - Propiedad ID {row.id}: {row.nombre} (estado: {row.estado})")
        else:
            print(f"✓ Todas las propiedades tienen vacancias: {prop_sin_vac}")

def check_estado_consistency():
    """Verificar consistencia de estados"""
    print_section("3. CONSISTENCIA DE ESTADOS")
    
    with engine.connect() as conn:
        # Propiedades sin estado_fecha
        result = conn.execute(text("""
            SELECT COUNT(*) FROM propiedades 
            WHERE estado_fecha IS NULL AND deleted_at IS NULL
        """))
        sin_fecha = result.scalar()
        
        if sin_fecha > 0:
            print(f"❌ Propiedades sin estado_fecha: {sin_fecha}")
            result = conn.execute(text("""
                SELECT id, nombre, estado 
                FROM propiedades 
                WHERE estado_fecha IS NULL AND deleted_at IS NULL
                LIMIT 10
            """))
            for row in result:
                print(f"   - ID {row.id}: {row.nombre} (estado: {row.estado})")
        else:
            print(f"✓ Todas las propiedades tienen estado_fecha: {sin_fecha}")
        
        # Distribución de estados
        print("\n📊 Distribución de estados de propiedades:")
        result = conn.execute(text("""
            SELECT estado, COUNT(*) as cantidad
            FROM propiedades
            WHERE deleted_at IS NULL
            GROUP BY estado
            ORDER BY estado
        """))
        
        estados = {
            "1-recibida": 0,
            "2-en_reparacion": 0,
            "3-disponible": 0,
            "4-alquilada": 0,
            "5-retirada": 0
        }
        
        for row in result:
            estados[row.estado] = row.cantidad
            print(f"   {row.estado}: {row.cantidad}")
        
        return estados

def check_vacancia_active_consistency():
    """Verificar consistencia de vacancias activas con estados de propiedades"""
    print_section("4. CONSISTENCIA VACANCIAS ACTIVAS VS ESTADOS")
    
    with engine.connect() as conn:
        # Propiedades alquiladas con vacancia activa (inconsistencia)
        result = conn.execute(text("""
            SELECT p.id, p.nombre, p.estado, p.estado_fecha, v.id as vacancia_id
            FROM propiedades p
            INNER JOIN vacancias v ON p.id = v.propiedad_id
            WHERE p.estado = '4-alquilada'
              AND v.ciclo_activo = true
              AND p.deleted_at IS NULL
              AND v.deleted_at IS NULL
        """))
        
        alquiladas_activas = list(result)
        if alquiladas_activas:
            print(f"❌ Propiedades alquiladas con vacancia activa: {len(alquiladas_activas)}")
            for row in alquiladas_activas[:10]:
                fecha = row.estado_fecha.strftime('%Y-%m-%d %H:%M') if row.estado_fecha else 'N/A'
                print(f"   - ID {row.id}: {row.nombre} | Estado: {row.estado} | Fecha: {fecha} | Vacancia: {row.vacancia_id}")
        else:
            print(f"✓ No hay propiedades alquiladas con vacancia activa")
        
        # Propiedades retiradas con vacancia activa (inconsistencia)
        result = conn.execute(text("""
            SELECT p.id, p.nombre, p.estado, p.estado_fecha, v.id as vacancia_id
            FROM propiedades p
            INNER JOIN vacancias v ON p.id = v.propiedad_id
            WHERE p.estado = '5-retirada'
              AND v.ciclo_activo = true
              AND p.deleted_at IS NULL
              AND v.deleted_at IS NULL
        """))
        
        retiradas_activas = list(result)
        if retiradas_activas:
            print(f"❌ Propiedades retiradas con vacancia activa: {len(retiradas_activas)}")
            for row in retiradas_activas[:10]:
                fecha = row.estado_fecha.strftime('%Y-%m-%d %H:%M') if row.estado_fecha else 'N/A'
                print(f"   - ID {row.id}: {row.nombre} | Estado: {row.estado} | Fecha: {fecha} | Vacancia: {row.vacancia_id}")
        else:
            print(f"✓ No hay propiedades retiradas con vacancia activa")
        
        # Propiedades en proceso sin vacancia activa (potencial inconsistencia)
        result = conn.execute(text("""
            SELECT p.id, p.nombre, p.estado, p.estado_fecha
            FROM propiedades p
            LEFT JOIN vacancias v ON p.id = v.propiedad_id AND v.ciclo_activo = true AND v.deleted_at IS NULL
            WHERE p.estado IN ('1-recibida', '2-en_reparacion', '3-disponible')
              AND v.id IS NULL
              AND p.deleted_at IS NULL
        """))
        
        proceso_sin_activa = list(result)
        if proceso_sin_activa:
            print(f"⚠️  Propiedades en proceso sin vacancia activa: {len(proceso_sin_activa)}")
            for row in proceso_sin_activa[:5]:
                fecha = row.estado_fecha.strftime('%Y-%m-%d %H:%M') if row.estado_fecha else 'N/A'
                print(f"   - ID {row.id}: {row.nombre} | Estado: {row.estado} | Fecha: {fecha}")
        else:
            print(f"✓ Todas las propiedades en proceso tienen vacancia activa")

def check_fecha_chronology():
    """Verificar cronología de fechas en vacancias"""
    print_section("5. CRONOLOGÍA DE FECHAS EN VACANCIAS")
    
    with engine.connect() as conn:
        # Verificar orden cronológico de fechas
        result = conn.execute(text("""
            SELECT 
                v.id,
                v.propiedad_id,
                p.nombre,
                v.fecha_recibida,
                v.fecha_en_reparacion,
                v.fecha_disponible,
                v.fecha_alquilada,
                v.fecha_retirada
            FROM vacancias v
            INNER JOIN propiedades p ON v.propiedad_id = p.id
            WHERE v.deleted_at IS NULL
            ORDER BY v.id
        """))
        
        inconsistencias = []
        for row in result:
            fechas = []
            if row.fecha_recibida:
                fechas.append(('recibida', row.fecha_recibida))
            if row.fecha_en_reparacion:
                fechas.append(('en_reparacion', row.fecha_en_reparacion))
            if row.fecha_disponible:
                fechas.append(('disponible', row.fecha_disponible))
            if row.fecha_alquilada:
                fechas.append(('alquilada', row.fecha_alquilada))
            if row.fecha_retirada:
                fechas.append(('retirada', row.fecha_retirada))
            
            # Verificar orden cronológico
            for i in range(len(fechas) - 1):
                if fechas[i][1] > fechas[i+1][1]:
                    inconsistencias.append({
                        'vacancia_id': row.id,
                        'propiedad': row.nombre,
                        'error': f"{fechas[i][0]} ({fechas[i][1]}) > {fechas[i+1][0]} ({fechas[i+1][1]})"
                    })
        
        if inconsistencias:
            print(f"❌ Vacancias con fechas fuera de orden: {len(inconsistencias)}")
            for inc in inconsistencias[:10]:
                print(f"   - Vacancia ID {inc['vacancia_id']}: {inc['propiedad']}")
                print(f"     {inc['error']}")
        else:
            print(f"✓ Todas las vacancias tienen fechas en orden cronológico")

def check_multiple_active_vacancias():
    """Verificar propiedades con múltiples vacancias activas"""
    print_section("6. MÚLTIPLES VACANCIAS ACTIVAS")
    
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT 
                p.id,
                p.nombre,
                p.estado,
                COUNT(v.id) as vacancias_activas
            FROM propiedades p
            INNER JOIN vacancias v ON p.id = v.propiedad_id
            WHERE v.ciclo_activo = true
              AND p.deleted_at IS NULL
              AND v.deleted_at IS NULL
            GROUP BY p.id, p.nombre, p.estado
            HAVING COUNT(v.id) > 1
        """))
        
        multiples = list(result)
        if multiples:
            print(f"❌ Propiedades con múltiples vacancias activas: {len(multiples)}")
            for row in multiples:
                print(f"   - ID {row.id}: {row.nombre} | Estado: {row.estado} | Vacancias activas: {row.vacancias_activas}")
        else:
            print(f"✓ No hay propiedades con múltiples vacancias activas")

def check_estado_fecha_vs_vacancia_fecha():
    """Verificar consistencia entre estado_fecha de propiedad y fechas de vacancia"""
    print_section("7. CONSISTENCIA ESTADO_FECHA VS FECHAS DE VACANCIA")
    
    with engine.connect() as conn:
        # Verificar que estado_fecha coincide con última fecha de vacancia activa
        result = conn.execute(text("""
            WITH ultima_fecha_vacancia AS (
                SELECT 
                    v.propiedad_id,
                    p.estado,
                    CASE 
                        WHEN p.estado = '1-recibida' THEN v.fecha_recibida
                        WHEN p.estado = '2-en_reparacion' THEN v.fecha_en_reparacion
                        WHEN p.estado = '3-disponible' THEN v.fecha_disponible
                        WHEN p.estado = '4-alquilada' THEN v.fecha_alquilada
                        WHEN p.estado = '5-retirada' THEN v.fecha_retirada
                    END as fecha_esperada
                FROM vacancias v
                INNER JOIN propiedades p ON v.propiedad_id = p.id
                WHERE v.ciclo_activo = true
                  AND v.deleted_at IS NULL
                  AND p.deleted_at IS NULL
            )
            SELECT 
                p.id,
                p.nombre,
                p.estado,
                p.estado_fecha,
                ufv.fecha_esperada
            FROM propiedades p
            INNER JOIN ultima_fecha_vacancia ufv ON p.id = ufv.propiedad_id
            WHERE p.estado_fecha IS NOT NULL
              AND ufv.fecha_esperada IS NOT NULL
              AND p.estado_fecha != ufv.fecha_esperada
              AND p.deleted_at IS NULL
        """))
        
        desincronizadas = list(result)
        if desincronizadas:
            print(f"⚠️  Propiedades con estado_fecha diferente a fecha de vacancia: {len(desincronizadas)}")
            for row in desincronizadas[:10]:
                fecha_prop = row.estado_fecha.strftime('%Y-%m-%d %H:%M') if row.estado_fecha else 'N/A'
                fecha_vac = row.fecha_esperada.strftime('%Y-%m-%d %H:%M') if row.fecha_esperada else 'N/A'
                print(f"   - ID {row.id}: {row.nombre}")
                print(f"     Estado: {row.estado}")
                print(f"     Propiedad: {fecha_prop} | Vacancia: {fecha_vac}")
        else:
            print(f"✓ estado_fecha sincronizado con fechas de vacancia")

def generate_summary_report(estados):
    """Generar reporte resumen"""
    print_section("RESUMEN EJECUTIVO")
    
    total = sum(estados.values())
    activas = estados["1-recibida"] + estados["2-en_reparacion"] + estados["3-disponible"]
    cerradas = estados["4-alquilada"] + estados["5-retirada"]
    
    print(f"\n📊 Distribución General:")
    print(f"   Total propiedades: {total}")
    print(f"   Propiedades activas (en proceso): {activas} ({activas/total*100:.1f}%)")
    print(f"   Propiedades cerradas: {cerradas} ({cerradas/total*100:.1f}%)")
    
    print(f"\n📈 Detalle por Estado:")
    print(f"   Recibidas: {estados['1-recibida']}")
    print(f"   En reparación: {estados['2-en_reparacion']}")
    print(f"   Disponibles: {estados['3-disponible']}")
    print(f"   Alquiladas: {estados['4-alquilada']}")
    print(f"   Retiradas: {estados['5-retirada']}")

def main():
    print("="*70)
    print("  VERIFICACIÓN DE CONSISTENCIA DE DATOS")
    print("  Propiedades y Vacancias")
    print("="*70)
    print(f"\nFecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        # 1. Conteos básicos
        total_prop, total_vac, vac_activas = check_basic_counts()
        
        # 2. Registros huérfanos
        check_orphan_records()
        
        # 3. Consistencia de estados
        estados = check_estado_consistency()
        
        # 4. Consistencia vacancias activas vs estados
        check_vacancia_active_consistency()
        
        # 5. Cronología de fechas
        check_fecha_chronology()
        
        # 6. Múltiples vacancias activas
        check_multiple_active_vacancias()
        
        # 7. Estado_fecha vs fechas de vacancia
        check_estado_fecha_vs_vacancia_fecha()
        
        # Resumen
        generate_summary_report(estados)
        
        print("\n" + "="*70)
        print("  ✅ VERIFICACIÓN COMPLETADA")
        print("="*70)
        print("\n📝 Revisa los mensajes marcados con ❌ o ⚠️  para identificar")
        print("   posibles inconsistencias que requieran corrección.\n")
        
    except Exception as e:
        print("\n" + "="*70)
        print("  ❌ ERROR EN LA VERIFICACIÓN")
        print("="*70)
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
