#!/usr/bin/env python3
"""
Script para verificar que las propiedades con alquiler y estado realizada 
tienen fechas de contrato completas.
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Cargar variables de entorno
load_dotenv()

# Obtener DATABASE_URL del entorno
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sak_dev")

# Ajustar URL si es necesario
if DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")

def main():
    """Función principal del script."""
    
    # Crear conexión a la base de datos
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("=== VERIFICACIÓN POST-ACTUALIZACIÓN ===")
        
        # Verificar propiedades de alquiler realizadas con fechas completas
        query = text("""
            SELECT 
                p.id,
                p.nombre,
                ps.nombre as estado_nombre,
                tol.nombre as tipo_operacion_nombre,
                p.fecha_ingreso,
                p.vencimiento_contrato,
                CASE 
                    WHEN p.fecha_ingreso IS NOT NULL AND p.vencimiento_contrato IS NOT NULL 
                    THEN 'COMPLETO'
                    ELSE 'INCOMPLETO'
                END as status_fechas,
                CASE 
                    WHEN p.vencimiento_contrato > CURRENT_DATE THEN 'VIGENTE'
                    WHEN p.vencimiento_contrato <= CURRENT_DATE THEN 'VENCIDO'
                    ELSE 'SIN FECHA'
                END as status_contrato
            FROM propiedades p
            LEFT JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
            LEFT JOIN crm_tipos_operacion tol ON p.tipo_operacion_id = tol.id
            WHERE tol.nombre ILIKE '%alquiler%' 
            AND ps.nombre ILIKE '%realizada%'
            ORDER BY p.id
        """)
        
        result = db.execute(query)
        propiedades = result.fetchall()
        
        # Contadores
        total = len(propiedades)
        completas = 0
        incompletas = 0
        vigentes = 0
        vencidos = 0
        
        print(f"Total de propiedades de alquiler realizadas: {total}")
        print("\nDetalle por propiedad:")
        print("=" * 80)
        
        for prop in propiedades:
            if prop.status_fechas == 'COMPLETO':
                completas += 1
            else:
                incompletas += 1
                
            if prop.status_contrato == 'VIGENTE':
                vigentes += 1
            elif prop.status_contrato == 'VENCIDO':
                vencidos += 1
            
            status_icon = "✓" if prop.status_fechas == 'COMPLETO' else "✗"
            contrato_icon = "🟢" if prop.status_contrato == 'VIGENTE' else "🔴" if prop.status_contrato == 'VENCIDO' else "⚪"
            
            print(f"{status_icon} ID {prop.id:2d}: {prop.nombre:30s} | Inicio: {prop.fecha_ingreso} | Venc: {prop.vencimiento_contrato} | {contrato_icon} {prop.status_contrato}")
        
        print("=" * 80)
        print(f"\n=== RESUMEN ESTADÍSTICO ===")
        print(f"Propiedades con fechas completas: {completas}/{total} ({100*completas/total:.1f}%)")
        print(f"Propiedades con fechas incompletas: {incompletas}/{total} ({100*incompletas/total:.1f}%)")
        
        if completas > 0:
            print(f"\nEstado de contratos:")
            print(f"- Vigentes: {vigentes} ({100*vigentes/total:.1f}%)")
            print(f"- Vencidos: {vencidos} ({100*vencidos/total:.1f}%)")
        
        if incompletas == 0:
            print("\n🎉 ¡ÉXITO! Todas las propiedades tienen fechas de contrato completas.")
        else:
            print(f"\n⚠️  Advertencia: {incompletas} propiedades aún necesitan fechas de contrato.")
        
        # Verificación adicional: propiedades sin ningún dato de fecha
        query_sin_fechas = text("""
            SELECT COUNT(*) as count
            FROM propiedades p
            LEFT JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
            LEFT JOIN crm_tipos_operacion tol ON p.tipo_operacion_id = tol.id
            WHERE tol.nombre ILIKE '%alquiler%' 
            AND ps.nombre ILIKE '%realizada%'
            AND (p.fecha_ingreso IS NULL OR p.vencimiento_contrato IS NULL)
        """)
        
        result_sin_fechas = db.execute(query_sin_fechas)
        sin_fechas = result_sin_fechas.scalar()
        
        if sin_fechas > 0:
            print(f"\n❌ {sin_fechas} propiedades aún tienen fechas faltantes.")
        else:
            print(f"\n✅ Todas las propiedades de alquiler realizadas tienen fechas completas.")
        
    except Exception as e:
        print(f"Error durante la verificación: {str(e)}")
        return 1
        
    finally:
        db.close()
    
    return 0

if __name__ == "__main__":
    main()