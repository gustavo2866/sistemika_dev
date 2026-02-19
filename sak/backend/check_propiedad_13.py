#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para verificar específicamente la propiedad ID 13
"""

import os
import sys
from pathlib import Path

# Agregar backend al path para importar módulos
backend_path = Path(__file__).parent
sys.path.append(str(backend_path))

from sqlalchemy import create_engine, text
from sqlmodel import Session

# Configuración de base de datos
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/sak_dev")

def main():
    """Verifica el estado de la propiedad 13."""
    
    print("🔍 Verificando estado de propiedad ID 13")
    print("=" * 50)
    
    try:
        engine = create_engine(DATABASE_URL)
    except Exception as e:
        print(f"❌ Error conectando a base de datos: {e}")
        return
    
    try:
        with Session(engine) as session:
            # Consultar propiedad 13
            query = """
            SELECT 
                p.id,
                p.nombre,
                p.estado,
                p.vacancia_activa,
                p.vacancia_fecha,
                p.estado_fecha,
                p.estado_comentario,
                p.updated_at
            FROM propiedades p
            WHERE p.id = 13;
            """
            
            result = session.execute(text(query))
            prop = result.fetchone()
            
            if not prop:
                print("❌ No se encontró la propiedad con ID 13")
                return
            
            print(f"🏠 Propiedad ID: {prop.id}")
            print(f"   Nombre: {prop.nombre}")
            print(f"   Estado: {prop.estado}")
            print(f"   Vacancia activa: {prop.vacancia_activa}")
            print(f"   Fecha vacancia: {prop.vacancia_fecha}")
            print(f"   Fecha estado: {prop.estado_fecha}")
            print(f"   Comentario: {prop.estado_comentario or 'Sin comentario'}")
            print(f"   Última actualización: {prop.updated_at}")
            
            # Verificar vacancia asociada
            query_vacancia = """
            SELECT 
                v.id,
                v.ciclo_activo,
                v.fecha_recibida,
                v.fecha_disponible,
                v.fecha_alquilada,
                v.fecha_retirada,
                v.updated_at
            FROM vacancias v
            WHERE v.propiedad_id = 13
            ORDER BY v.id DESC;
            """
            
            result = session.execute(text(query_vacancia))
            vacancias = result.fetchall()
            
            print(f"\n📋 Vacancias asociadas ({len(vacancias)} registros):")
            for v in vacancias:
                print(f"   ID: {v.id}, Activo: {v.ciclo_activo}")
                print(f"   Recibida: {v.fecha_recibida}")
                print(f"   Disponible: {v.fecha_disponible}")
                print(f"   Alquilada: {v.fecha_alquilada}")
                print(f"   Retirada: {v.fecha_retirada}")
                print(f"   Actualizada: {v.updated_at}")
                print("   " + "-" * 30)
            
            # Determinar si hay inconsistencia
            inconsistencia = False
            if prop.estado == '4-realizada' and prop.vacancia_activa:
                inconsistencia = True
                print("\n⚠️  INCONSISTENCIA DETECTADA:")
                print("   Estado = '4-realizada' pero vacancia_activa = true")
            
            vacancias_activas = [v for v in vacancias if v.ciclo_activo]
            if vacancias_activas:
                print(f"\n⚠️  Hay {len(vacancias_activas)} vacancia(s) con ciclo activo")
                if prop.estado == '4-realizada':
                    inconsistencia = True
            
            if inconsistencia:
                print("\n🔧 CORRECCIÓN NECESARIA")
                print("   Ejecutar: python fix_inconsistencia_realizada_vacancia.py")
            else:
                print("\n✅ No se detectaron inconsistencias")

    except Exception as e:
        print(f"❌ Error ejecutando consultas: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()