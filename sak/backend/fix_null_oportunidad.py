#!/usr/bin/env python3
"""Verificar y limpiar registros NULL en oportunidad_id"""

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
    print("Verificando registros con oportunidad_id NULL...")
    
    with engine.begin() as conn:
        # Contar registros NULL
        result = conn.execute(text("SELECT COUNT(*) FROM crm_eventos WHERE oportunidad_id IS NULL"))
        null_count = result.scalar()
        print(f"Registros con oportunidad_id NULL: {null_count}")
        
        if null_count > 0:
            # Mostrar algunos ejemplos
            result = conn.execute(text("""
                SELECT id, titulo, fecha_evento, contacto_id, oportunidad_id 
                FROM crm_eventos 
                WHERE oportunidad_id IS NULL 
                LIMIT 5
            """))
            
            print("\nEjemplos de registros con NULL:")
            for row in result:
                print(f"ID: {row.id}, Título: {row.titulo}, Fecha: {row.fecha_evento}, Contacto: {row.contacto_id}")
        
        # Verificar si hay oportunidades disponibles para asignar
        result = conn.execute(text("SELECT COUNT(*) FROM crm_oportunidades"))
        oportunidades_count = result.scalar()
        print(f"\nOportunidades disponibles: {oportunidades_count}")
        
        if oportunidades_count > 0:
            result = conn.execute(text("SELECT id FROM crm_oportunidades LIMIT 1"))
            primera_oportunidad = result.scalar()
            print(f"Primera oportunidad ID: {primera_oportunidad}")

            # Si hay registros NULL y hay oportunidades, ofrecer actualizar
            if null_count > 0:
                print(f"\n¿Actualizar todos los registros NULL con oportunidad_id={primera_oportunidad}? (y/n)")
                respuesta = input().lower()
                if respuesta == 'y':
                    result = conn.execute(text(f"""
                        UPDATE crm_eventos 
                        SET oportunidad_id = {primera_oportunidad} 
                        WHERE oportunidad_id IS NULL
                    """))
                    print(f"Actualizados {result.rowcount} registros")

if __name__ == "__main__":
    main()