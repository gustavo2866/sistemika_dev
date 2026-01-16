#!/usr/bin/env python3
"""Limpiar registros NULL en crm_eventos"""

import os
from sqlalchemy import create_engine, text

# Cargar .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Usar la DATABASE_URL del entorno
db_url = os.getenv('DATABASE_URL')
if not db_url:
    print("ERROR: DATABASE_URL no está definida")
    exit(1)

engine = create_engine(db_url)

def main():
    print("Limpiando valores NULL en crm_eventos...")
    
    with engine.begin() as conn:
        # Verificar titulo NULL
        result = conn.execute(text("SELECT COUNT(*) FROM crm_eventos WHERE titulo IS NULL"))
        titulo_null_count = result.scalar()
        print(f"Registros con titulo NULL: {titulo_null_count}")
        
        # Verificar oportunidad_id NULL (por si acaso)
        result = conn.execute(text("SELECT COUNT(*) FROM crm_eventos WHERE oportunidad_id IS NULL"))
        oportunidad_null_count = result.scalar()
        print(f"Registros con oportunidad_id NULL: {oportunidad_null_count}")
        
        if titulo_null_count > 0:
            print("Actualizando registros con titulo NULL...")
            result = conn.execute(text("""
                UPDATE crm_eventos 
                SET titulo = COALESCE(titulo, 'Evento sin título') 
                WHERE titulo IS NULL
            """))
            print(f"Actualizados {result.rowcount} registros para titulo")
        
        if oportunidad_null_count > 0:
            # Obtener primera oportunidad
            result = conn.execute(text("SELECT id FROM crm_oportunidades LIMIT 1"))
            primera_oportunidad = result.scalar()
            if primera_oportunidad:
                print(f"Actualizando registros con oportunidad_id NULL a {primera_oportunidad}...")
                result = conn.execute(text(f"""
                    UPDATE crm_eventos 
                    SET oportunidad_id = {primera_oportunidad} 
                    WHERE oportunidad_id IS NULL
                """))
                print(f"Actualizados {result.rowcount} registros para oportunidad_id")
        
        print("Verificación final:")
        result = conn.execute(text("SELECT COUNT(*) FROM crm_eventos WHERE titulo IS NULL OR oportunidad_id IS NULL"))
        remaining_nulls = result.scalar()
        print(f"Registros con campos NULL restantes: {remaining_nulls}")

if __name__ == "__main__":
    main()