#!/usr/bin/env python3
"""
Script para verificar y limpiar datos antes de la migración
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def main():
    # Cargar variables de entorno
    load_dotenv()
    
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("❌ ERROR: DATABASE_URL no está configurado")
        return
    
    engine = create_engine(db_url)
    
    try:
        with engine.connect() as conn:
            # Verificar datos en crm_eventos
            print("🔍 Verificando datos en crm_eventos...")
            result = conn.execute(text("SELECT COUNT(*) as total, COUNT(oportunidad_id) as con_oportunidad FROM crm_eventos"))
            row = result.fetchone()
            
            print(f"📊 Total registros: {row.total}")
            print(f"📊 Con oportunidad_id: {row.con_oportunidad}")
            print(f"📊 Con NULL: {row.total - row.con_oportunidad}")
            
            if row.total - row.con_oportunidad > 0:
                print("\n⚠️  Hay registros con oportunidad_id NULL.")
                print("Opciones:")
                print("1. Eliminar registros con NULL")
                print("2. Asignar una oportunidad por defecto")
                print("3. Cancelar y revisar manualmente")
                
                # Por ahora, vamos a eliminar los registros con NULL
                print("\n🗑️  Eliminando registros con oportunidad_id NULL...")
                result = conn.execute(text("DELETE FROM crm_eventos WHERE oportunidad_id IS NULL"))
                print(f"✅ Eliminados {result.rowcount} registros")
                conn.commit()
            else:
                print("✅ No hay registros con oportunidad_id NULL")
    
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    main()