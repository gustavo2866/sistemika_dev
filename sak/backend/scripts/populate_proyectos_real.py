#!/usr/bin/env python3
"""Script para poblar la tabla proyectos con datos reales."""

import os
import sys
from datetime import date, datetime
from decimal import Decimal

# Agregar el directorio backend al path para importar módulos
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.insert(0, backend_dir)

from sqlmodel import Session, select
from dotenv import load_dotenv
from app.models.proyecto import Proyecto
from app.db import engine


def get_db_session():
    """Obtener sesión de base de datos."""
    return Session(engine)


# Datos reales de proyectos (de la imagen proporcionada)
PROYECTOS_REALES = [
    {
        "centro_costo": 1096,
        "nombre": "Camino del Peru y Santiago",
        "fecha_inicio": date(2025, 10, 1),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("500000000.00"),
    },
    {
        "centro_costo": 1183,
        "nombre": "General Paz 253",
        "fecha_inicio": date(2024, 2, 23),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("100000000.00"),
    },
    {
        "centro_costo": 1200,
        "nombre": "Buenos Aires 744",
        "fecha_inicio": date(2024, 2, 1),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("560000000.00"),
    },
    {
        "centro_costo": 1201,
        "nombre": "Loteos Prados de Yerba Buena",
        "fecha_inicio": date(2024, 1, 15),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("100000000.00"),
    },
    {
        "centro_costo": 1202,
        "nombre": "Celedonio Gutierrez 247",
        "fecha_inicio": date(2024, 1, 1),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("230000000.00"),
    },
    {
        "centro_costo": 1206,
        "nombre": "Altos de Yerba Buena",
        "fecha_inicio": date(2024, 1, 4),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("890000000.00"),
    },
    {
        "centro_costo": 1212,
        "nombre": "DIVISADERO II",
        "fecha_inicio": date(2025, 6, 4),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("560000000.00"),
    },
    {
        "centro_costo": 1213,
        "nombre": "La Rioja 474-Boreal",
        "fecha_inicio": date(2024, 1, 8),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("1450000000.00"),
    },
    {
        "centro_costo": 1216,
        "nombre": "Mate de Luna 1845",
        "fecha_inicio": date(2026, 1, 31),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("600000000.00"),
    },
    {
        "centro_costo": 1217,
        "nombre": "Loteo Tres Socios Alderetes",
        "fecha_inicio": date(2024, 3, 20),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("300000000.00"),
    },
    {
        "centro_costo": 1222,
        "nombre": "San Pablo Residences",
        "fecha_inicio": date(2024, 1, 27),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("100000000.00"),
    },
    {
        "centro_costo": 1224,
        "nombre": "Torres SP SRL-Solana Yerba s/n-San Pablo",
        "fecha_inicio": date(2024, 8, 30),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("1300000000.00"),
    },
    {
        "centro_costo": 1225,
        "nombre": "Catamarca y Corrientes",
        "fecha_inicio": date(2024, 12, 4),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("560000000.00"),
    },
    {
        "centro_costo": 1226,
        "nombre": "Florida 115-Obra Pringles",
        "fecha_inicio": date(2024, 11, 1),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("350000000.00"),
    },
    {
        "centro_costo": 1229,
        "nombre": "Mate de Luna 1872",
        "fecha_inicio": date(2024, 1, 5),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("150000000.00"),
    },
    {
        "centro_costo": 1233,
        "nombre": "AXION ? Emilio Castelar 1003",
        "fecha_inicio": date(2025, 11, 19),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("500000000.00"),
    },
    {
        "centro_costo": 1236,
        "nombre": "Francia 118",
        "fecha_inicio": date(2025, 12, 17),
        "fecha_final": date(2027, 12, 31),
        "ingresos": Decimal("300000000.00"),
    },
]


def generar_valores_ficticios(ingresos):
    """Generar valores ficticios basados en los ingresos."""
    ingresos = float(ingresos)
    
    # Calcular porcentajes aproximados
    importe_mat = Decimal(str(ingresos * 0.35))  # 35% para materiales
    importe_mo = Decimal(str(ingresos * 0.25))   # 25% para mano de obra
    terceros = Decimal(str(ingresos * 0.12))     # 12% para terceros
    herramientas = Decimal(str(ingresos * 0.06)) # 6% para herramientas
    
    # Superficie entre 85% y 95%
    import random
    superficie = Decimal(str(round(random.uniform(85.0, 95.0), 2)))
    
    # Estados posibles
    estados = ["planificado", "en_ejecucion", "pausado"]
    estado = random.choice(estados)
    
    return {
        "importe_mat": importe_mat,
        "importe_mo": importe_mo,
        "terceros": terceros,
        "herramientas": herramientas,
        "superficie": superficie,
        "estado": estado,
        "comentario": f"Proyecto de construcción e inversión inmobiliaria."
    }


def poblar_proyectos():
    """Poblar la tabla proyectos con datos reales."""
    session = get_db_session()
    
    try:
        print("🚀 Iniciando población de proyectos...")
        
        # Verificar si ya existen proyectos con los mismos centros de costo
        centros_costo = [p["centro_costo"] for p in PROYECTOS_REALES]
        statement = select(Proyecto).where(Proyecto.centro_costo.in_(centros_costo))
        proyectos_existentes = session.exec(statement).all()
        
        if proyectos_existentes:
            print(f"⚠️  Se encontraron {len(proyectos_existentes)} proyectos existentes con los mismos centros de costo.")
            respuesta = input("¿Deseas actualizar los existentes? (s/N): ").lower().strip()
            if respuesta != 's':
                print("❌ Operación cancelada.")
                return
        
        proyectos_creados = 0
        proyectos_actualizados = 0
        
        for proyecto_data in PROYECTOS_REALES:
            centro_costo = proyecto_data["centro_costo"]
            
            # Buscar si existe un proyecto con este centro de costo
            statement = select(Proyecto).where(Proyecto.centro_costo == centro_costo)
            proyecto_existente = session.exec(statement).first()
            
            # Generar valores ficticios
            valores_ficticios = generar_valores_ficticios(proyecto_data["ingresos"])
            
            if proyecto_existente:
                # Actualizar proyecto existente
                for campo, valor in proyecto_data.items():
                    if campo != "centro_costo":
                        setattr(proyecto_existente, campo, valor)
                
                # Actualizar valores ficticios
                for campo, valor in valores_ficticios.items():
                    setattr(proyecto_existente, campo, valor)
                
                proyecto_existente.updated_at = datetime.utcnow()
                proyectos_actualizados += 1
                print(f"🔄 Actualizado: {proyecto_data['nombre']}")
                
            else:
                # Crear nuevo proyecto
                proyecto_nuevo = Proyecto(
                    **proyecto_data,
                    **valores_ficticios
                )
                session.add(proyecto_nuevo)
                proyectos_creados += 1
                print(f"✅ Creado: {proyecto_data['nombre']}")
        
        # Confirmar cambios
        session.commit()
        
        print(f"\n🎉 ¡Población completada!")
        print(f"   • Proyectos creados: {proyectos_creados}")
        print(f"   • Proyectos actualizados: {proyectos_actualizados}")
        print(f"   • Total procesados: {len(PROYECTOS_REALES)}")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error durante la población: {e}")
        raise
    finally:
        session.close()


def listar_proyectos():
    """Listar los proyectos existentes."""
    session = get_db_session()
    
    try:
        statement = select(Proyecto).order_by(Proyecto.centro_costo)
        proyectos = session.exec(statement).all()
        
        if not proyectos:
            print("📋 No hay proyectos en la base de datos.")
            return
        
        print(f"\n📋 Proyectos existentes ({len(proyectos)}):")
        print("-" * 100)
        print(f"{'Centro':<8} {'Nombre':<40} {'Ingresos':<15} {'Estado':<12}")
        print("-" * 100)
        
        for proyecto in proyectos:
            ingresos_formatted = f"${proyecto.ingresos:,.0f}" if proyecto.ingresos else "N/A"
            print(f"{proyecto.centro_costo or 'N/A':<8} {proyecto.nombre[:40]:<40} {ingresos_formatted:<15} {proyecto.estado or 'N/A':<12}")
        
    finally:
        session.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Gestionar población de proyectos")
    parser.add_argument("--listar", action="store_true", help="Listar proyectos existentes")
    parser.add_argument("--poblar", action="store_true", help="Poblar proyectos con datos reales")
    
    args = parser.parse_args()
    
    if args.listar:
        listar_proyectos()
    elif args.poblar:
        poblar_proyectos()
    else:
        print("Uso: python populate_proyectos_real.py --poblar | --listar")
        parser.print_help()