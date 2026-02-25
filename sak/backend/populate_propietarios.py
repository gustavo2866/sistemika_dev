"""
Script para poblar la entidad Propietario con 25 propietarios de ejemplo
"""

import sys
from pathlib import Path
import random

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent))

from sqlmodel import Session, create_engine, select
from dotenv import load_dotenv
import os

from app.models.propietario import Propietario

# Cargar variables de entorno
load_dotenv()

# Configurar conexión a la base de datos
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL no está configurada")

engine = create_engine(DATABASE_URL)

# Datos de propietarios para poblar
PROPIETARIOS_DATA = [
    {
        "nombre": "Carlos Alberto Mendoza",
        "adm_concepto_id": 1,  # Sueldos y Salarios
        "centro_costo_id": 2,  # Propiedad - Edificio Centro
        "comentario": "Propietario principal del edificio del centro. Contacto directo para mantenimiento.",
        "activo": True
    },
    {
        "nombre": "María Elena Rodríguez",
        "adm_concepto_id": 4,  # Alquiler de Oficina
        "centro_costo_id": 3,  # Propiedad - Torre Palermo
        "comentario": "Propietaria de departamento en Torre Palermo. Prefiere comunicación por email.",
        "activo": True
    },
    {
        "nombre": "Juan Carlos Fernández",
        "adm_concepto_id": 3,  # Honorarios Profesionales
        "centro_costo_id": 4,  # Propiedad - Complejo Norte
        "comentario": "Arquitecto propietario de local comercial. Disponible para consultas técnicas.",
        "activo": True
    },
    {
        "nombre": "Ana Beatriz López",
        "adm_concepto_id": 2,  # Cargas Sociales
        "centro_costo_id": 1,  # Socios-Gustavo
        "comentario": "Socia propietaria de oficinas administrativas.",
        "activo": True
    },
    {
        "nombre": "Roberto Daniel García",
        "adm_concepto_id": 5,  # Servicios Públicos
        "centro_costo_id": 7,  # General-Administración
        "comentario": "Propietario de depósito. Contactar solo en horario laboral.",
        "activo": False
    },
    {
        "nombre": "Carmen Rosa Martínez",
        "adm_concepto_id": 6,  # Telecomunicaciones
        "centro_costo_id": 2,  # Propiedad - Edificio Centro
        "comentario": "Propietaria de local en planta baja. Muy colaborativa con el mantenimiento.",
        "activo": True
    },
    {
        "nombre": "Pedro Miguel Silva",
        "adm_concepto_id": 8,  # Combustibles
        "centro_costo_id": 8,  # General-Inmobiliaria
        "comentario": "Propietario de cocheras. Especialista en estacionamientos.",
        "activo": True
    },
    {
        "nombre": "Lucía Esperanza Torres",
        "adm_concepto_id": 7,  # Papelería y Útiles
        "centro_costo_id": 3,  # Propiedad - Torre Palermo
        "comentario": "Propietaria de oficina ejecutiva. Excelente relación comercial.",
        "activo": True
    },
    {
        "nombre": "Francisco Javier Morales",
        "adm_concepto_id": 9,  # Mantenimiento y Reparaciones
        "centro_costo_id": 4,  # Propiedad - Complejo Norte
        "comentario": "Contratista propietario de taller. Disponible para emergencias.",
        "activo": True
    },
    {
        "nombre": "Sofía Alejandra Ramírez",
        "adm_concepto_id": 10,  # Seguros
        "centro_costo_id": 9,  # General-Proyectos
        "comentario": "Propietaria consultora. Especialista en seguros inmobiliarios.",
        "activo": True
    },
    {
        "nombre": "Alberto Manuel Herrera",
        "adm_concepto_id": 11,  # (si existe, sino usar 1)
        "centro_costo_id": 10,  # General-Sistemas
        "comentario": "Propietario de local técnico. Manejo de sistemas de seguridad.",
        "activo": True
    },
    {
        "nombre": "Valentina Isabel Cruz",
        "adm_concepto_id": 1,  # Sueldos y Salarios
        "centro_costo_id": 5,  # Proyecto - Remodelacion Centro de Servicios
        "comentario": "Propietaria de espacio en remodelación. Seguimiento continuo del proyecto.",
        "activo": True
    },
    {
        "nombre": "Diego Andrés Vargas",
        "adm_concepto_id": 2,  # Cargas Sociales
        "centro_costo_id": 6,  # Proyecto - Construccion Nave Industrial 2
        "comentario": "Inversionista propietario. Interés en expansión industrial.",
        "activo": False
    },
    {
        "nombre": "Isabella María Jiménez",
        "adm_concepto_id": 3,  # Honorarios Profesionales
        "centro_costo_id": 2,  # Propiedad - Edificio Centro
        "comentario": "Abogada propietaria. Asesora legal del consorcio.",
        "activo": True
    },
    {
        "nombre": "Nicolás Sebastián Ortiz",
        "adm_concepto_id": 4,  # Alquiler de Oficina
        "centro_costo_id": 3,  # Propiedad - Torre Palermo
        "comentario": "Propietario de penthouse. Exigente con los servicios.",
        "activo": True
    },
    {
        "nombre": "Camila Andrea Peña",
        "adm_concepto_id": 5,  # Servicios Públicos
        "centro_costo_id": 4,  # Propiedad - Complejo Norte
        "comentario": "Propietaria de local gastronómico. Horarios especiales.",
        "activo": True
    },
    {
        "nombre": "Mateo Alejandro Ruiz",
        "adm_concepto_id": 6,  # Telecomunicaciones
        "centro_costo_id": 1,  # Socios-Gustavo
        "comentario": "Socio tecnológico. Propietario de data center.",
        "activo": True
    },
    {
        "nombre": "Emma Catalina Vega",
        "adm_concepto_id": 7,  # Papelería y Útiles
        "centro_costo_id": 7,  # General-Administración
        "comentario": "Propietaria de oficinas administrativas. Coordinadora de propietarios.",
        "activo": True
    },
    {
        "nombre": "Santiago Rafael Molina",
        "adm_concepto_id": 8,  # Combustibles
        "centro_costo_id": 8,  # General-Inmobiliaria
        "comentario": "Propietario de estación de servicio anexa. Servicios complementarios.",
        "activo": False
    },
    {
        "nombre": "Gabriela Fernanda Castro",
        "adm_concepto_id": 9,  # Mantenimiento y Reparaciones
        "centro_costo_id": 9,  # General-Proyectos
        "comentario": "Ingeniera propietaria. Supervisora técnica de proyectos.",
        "activo": True
    },
    {
        "nombre": "Benjamín Eduardo Ramos",
        "adm_concepto_id": 10,  # Seguros
        "centro_costo_id": 10,  # General-Sistemas
        "comentario": "Propietario de centro de cómputos. Servicios de backup.",
        "activo": True
    },
    {
        "nombre": "Renata Victoria Aguilar",
        "adm_concepto_id": 1,  # Sueldos y Salarios
        "centro_costo_id": 2,  # Propiedad - Edificio Centro
        "comentario": "Propietaria de múltiples unidades. Portfolio diversificado.",
        "activo": True
    },
    {
        "nombre": "Maximiliano José Paredes",
        "adm_concepto_id": 2,  # Cargas Sociales
        "centro_costo_id": 3,  # Propiedad - Torre Palermo
        "comentario": "Propietario financiero. Análisis de rentabilidad inmobiliaria.",
        "activo": True
    },
    {
        "nombre": "Ariana Soledad Navarro",
        "adm_concepto_id": 3,  # Honorarios Profesionales
        "centro_costo_id": 4,  # Propiedad - Complejo Norte
        "comentario": "Médica propietaria de consultorios. Horarios restringidos.",
        "activo": True
    },
    {
        "nombre": "Emilio Cristian Guerrero",
        "adm_concepto_id": 4,  # Alquiler de Oficina
        "centro_costo_id": 5,  # Proyecto - Remodelacion Centro de Servicios
        "comentario": "Propietario en proceso de mudanza. Contacto temporal.",
        "activo": False
    }
]


def main():
    """Función principal para poblar propietarios"""
    print("🏢 Iniciando población de propietarios...")
    print(f"📊 Propietarios a crear: {len(PROPIETARIOS_DATA)}")
    
    propietarios_creados = 0
    propietarios_duplicados = 0
    
    try:
        with Session(engine) as session:
            for propietario_data in PROPIETARIOS_DATA:
                # Verificar si ya existe un propietario con el mismo nombre
                existing = session.exec(
                    select(Propietario).where(
                        Propietario.nombre == propietario_data["nombre"]
                    )
                ).first()
                
                if existing:
                    print(f"⚠️  Propietario '{propietario_data['nombre']}' ya existe")
                    propietarios_duplicados += 1
                    continue
                
                # Crear nuevo propietario
                propietario = Propietario(**propietario_data)
                session.add(propietario)
                propietarios_creados += 1
                estado = "✅" if propietario_data["activo"] else "🔴"
                print(f"{estado} Creado: {propietario_data['nombre']}")
            
            # Confirmar cambios
            session.commit()
            print(f"\n🎉 Proceso completado:")
            print(f"   - Propietarios creados: {propietarios_creados}")
            print(f"   - Propietarios duplicados (omitidos): {propietarios_duplicados}")
            print(f"   - Total en base de datos: {len(session.exec(select(Propietario)).all())}")
            
            # Mostrar estadísticas
            activos = len(session.exec(select(Propietario).where(Propietario.activo == True)).all())
            inactivos = len(session.exec(select(Propietario).where(Propietario.activo == False)).all())
            print(f"   - Propietarios activos: {activos}")
            print(f"   - Propietarios inactivos: {inactivos}")
            
    except Exception as e:
        print(f"❌ Error durante la población: {e}")
        raise


if __name__ == "__main__":
    main()