#!/usr/bin/env python3
"""Verificar y limpiar registros NULL en oportunidad_id"""

import os
import sys
sys.path.append('.')

from app.core.database import engine
from sqlalchemy import text

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
                SELECT id, titulo, fecha, contacto_id, oportunidad_id 
                FROM crm_eventos 
                WHERE oportunidad_id IS NULL 
                LIMIT 5
            """))
            
            print("\nEjemplos de registros con NULL:")
            for row in result:
                print(f"ID: {row.id}, Título: {row.titulo}, Contacto: {row.contacto_id}")
        
        # Verificar si hay oportunidades disponibles para asignar
        result = conn.execute(text("SELECT COUNT(*) FROM crm_oportunidades"))
        oportunidades_count = result.scalar()
        print(f"\nOportunidades disponibles: {oportunidades_count}")
        
        if oportunidades_count > 0:
            result = conn.execute(text("SELECT id FROM crm_oportunidades LIMIT 1"))
            primera_oportunidad = result.scalar()
            print(f"Primera oportunidad ID: {primera_oportunidad}")

if __name__ == "__main__":
    main()