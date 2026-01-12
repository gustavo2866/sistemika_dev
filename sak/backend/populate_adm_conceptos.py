"""
Script para poblar la entidad AdmConcepto con conceptos generales administrativos
"""

import sys
from pathlib import Path

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent))

from sqlmodel import Session, create_engine, select
from dotenv import load_dotenv
import os

from app.models.adm import AdmConcepto

# Cargar variables de entorno
load_dotenv()

# Configurar conexión a la base de datos
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL no está configurada")

engine = create_engine(DATABASE_URL)

# Datos de conceptos administrativos generales
CONCEPTOS_DATA = [
    {
        "nombre": "Sueldos y Salarios",
        "descripcion": "Remuneraciones del personal en relación de dependencia",
        "cuenta": "621001"
    },
    {
        "nombre": "Cargas Sociales",
        "descripcion": "Contribuciones patronales y cargas sociales",
        "cuenta": "621002"
    },
    {
        "nombre": "Honorarios Profesionales",
        "descripcion": "Servicios profesionales y consultoría externa",
        "cuenta": "622001"
    },
    {
        "nombre": "Alquiler de Oficina",
        "descripcion": "Arrendamiento de inmuebles para uso administrativo",
        "cuenta": "623001"
    },
    {
        "nombre": "Servicios Públicos",
        "descripcion": "Electricidad, gas, agua y servicios básicos",
        "cuenta": "623002"
    },
    {
        "nombre": "Telecomunicaciones",
        "descripcion": "Telefonía, internet y comunicaciones",
        "cuenta": "623003"
    },
    {
        "nombre": "Papelería y Útiles",
        "descripcion": "Materiales de oficina y suministros administrativos",
        "cuenta": "624001"
    },
    {
        "nombre": "Combustibles",
        "descripcion": "Nafta, gasoil y combustibles para vehículos",
        "cuenta": "624002"
    },
    {
        "nombre": "Mantenimiento y Reparaciones",
        "descripcion": "Servicios de mantenimiento de equipos e instalaciones",
        "cuenta": "624003"
    },
    {
        "nombre": "Seguros",
        "descripcion": "Pólizas de seguros diversos",
        "cuenta": "625001"
    },
    {
        "nombre": "Impuestos y Tasas",
        "descripcion": "Impuestos municipales, provinciales y tasas varias",
        "cuenta": "625002"
    },
    {
        "nombre": "Gastos Bancarios",
        "descripcion": "Comisiones bancarias y gastos financieros menores",
        "cuenta": "625003"
    },
    {
        "nombre": "Publicidad y Marketing",
        "descripcion": "Gastos en promoción, publicidad y marketing",
        "cuenta": "626001"
    },
    {
        "nombre": "Capacitación y Desarrollo",
        "descripcion": "Cursos, seminarios y desarrollo del personal",
        "cuenta": "626002"
    },
    {
        "nombre": "Gastos Varios",
        "descripcion": "Gastos administrativos diversos no clasificados",
        "cuenta": "629001"
    }
]


def main():
    """Función principal para poblar conceptos"""
    print("🚀 Iniciando población de conceptos administrativos...")
    
    try:
        with Session(engine) as session:
            # Verificar si ya existen conceptos
            existing_count = len(session.exec(select(AdmConcepto)).all())
            
            if existing_count > 0:
                print(f"⚠️  Ya existen {existing_count} conceptos en la base de datos")
                response = input("¿Desea continuar y agregar los nuevos conceptos? (s/N): ")
                if response.lower() != 's':
                    print("❌ Operación cancelada")
                    return
            
            conceptos_creados = 0
            conceptos_duplicados = 0
            
            for concepto_data in CONCEPTOS_DATA:
                # Verificar si el concepto ya existe por nombre o cuenta
                existing = session.exec(
                    select(AdmConcepto).where(
                        (AdmConcepto.nombre == concepto_data["nombre"]) |
                        (AdmConcepto.cuenta == concepto_data["cuenta"])
                    )
                ).first()
                
                if existing:
                    print(f"⚠️  Concepto '{concepto_data['nombre']}' ya existe")
                    conceptos_duplicados += 1
                    continue
                
                # Crear nuevo concepto
                concepto = AdmConcepto(**concepto_data)
                session.add(concepto)
                conceptos_creados += 1
                print(f"✅ Creado: {concepto_data['nombre']} (Cuenta: {concepto_data['cuenta']})")
            
            # Confirmar cambios
            session.commit()
            print(f"\n🎉 Proceso completado:")
            print(f"   - Conceptos creados: {conceptos_creados}")
            print(f"   - Conceptos duplicados (omitidos): {conceptos_duplicados}")
            print(f"   - Total en base de datos: {len(session.exec(select(AdmConcepto)).all())}")
            
    except Exception as e:
        print(f"❌ Error durante la población: {e}")
        raise


if __name__ == "__main__":
    main()