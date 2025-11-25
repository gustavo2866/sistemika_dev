"""
Script para poblar propiedades disponibles con diferentes escenarios de oportunidades perdidas.

Escenarios:
1. Propiedades disponibles con muchas oportunidades perdidas (difíciles de alquilar)
2. Propiedades disponibles con pocas oportunidades perdidas
3. Propiedades disponibles sin oportunidades relacionadas
4. Propiedades con diferentes antigüedades de disponibilidad
"""

import random
from datetime import datetime, timedelta, date
from decimal import Decimal

from dotenv import load_dotenv
from sqlmodel import Session, select

from app.db import engine
from app.models.propiedad import Propiedad
from app.models.crm_oportunidad import CRMOportunidad
from app.models.crm_contacto import CRMContacto
from app.models.user import User
from app.models.crm_catalogos import CRMTipoOperacion, CRMMotivoPerdida, Moneda
from app.models.enums import EstadoOportunidad, EstadoPropiedad

# Cargar variables de entorno
load_dotenv()

UTC = datetime.now().astimezone().tzinfo


def generar_fecha_aleatoria(desde: datetime, hasta: datetime) -> datetime:
    """Genera una fecha aleatoria entre dos fechas."""
    delta = hasta - desde
    dias_aleatorios = random.randint(0, delta.days)
    horas_aleatorias = random.randint(0, 23)
    return desde + timedelta(days=dias_aleatorios, hours=horas_aleatorias)


def main():
    print("\n" + "="*80)
    print("  SCRIPT DE POBLACIÓN DE PROPIEDADES DISPONIBLES")
    print("="*80)
    
    with Session(engine) as session:
        # Obtener datos necesarios
        contactos = list(session.exec(select(CRMContacto).where(CRMContacto.deleted_at.is_(None))).all())
        usuarios = list(session.exec(select(User).where(User.deleted_at.is_(None))).all())
        tipos_operacion = list(session.exec(select(CRMTipoOperacion).where(CRMTipoOperacion.deleted_at.is_(None))).all())
        motivos_perdida = list(session.exec(select(CRMMotivoPerdida).where(CRMMotivoPerdida.deleted_at.is_(None))).all())
        moneda_usd = session.exec(select(Moneda).where(Moneda.codigo == "USD").where(Moneda.deleted_at.is_(None))).first()
        
        if not contactos or not usuarios or not tipos_operacion:
            print("❌ Error: No hay datos suficientes en la base de datos")
            print(f"   Contactos: {len(contactos)}, Usuarios: {len(usuarios)}, Tipos operación: {len(tipos_operacion)}")
            return
        
        print(f"\n📊 Datos disponibles:")
        print(f"  - {len(contactos)} contactos")
        print(f"  - {len(usuarios)} usuarios")
        print(f"  - {len(tipos_operacion)} tipos de operación")
        print(f"  - {len(motivos_perdida)} motivos de pérdida")
        
        # Fecha actual fija
        hoy = datetime(2025, 11, 25, tzinfo=UTC)
        hace_2_años = hoy - timedelta(days=730)
        
        # ESCENARIO 1: Propiedades con muchas oportunidades perdidas (difíciles de alquilar)
        print("\n" + "="*80)
        print("  ESCENARIO 1: Propiedades difíciles (muchas oportunidades perdidas)")
        print("="*80)
        
        propiedades_dificiles = [
            {
                "nombre": "Oficina Microcentro Oscura",
                "descripcion": "Oficina con problemas de iluminación natural",
                "perdidas": 8,
                "dias_disponible": 180,
            },
            {
                "nombre": "Local Zona Sur Sin Estacionamiento",
                "descripcion": "Local en zona sin fácil acceso",
                "perdidas": 12,
                "dias_disponible": 240,
            },
            {
                "nombre": "Depto 1 amb Muy Caro",
                "descripcion": "Monoambiente con precio por encima del mercado",
                "perdidas": 15,
                "dias_disponible": 365,
            },
            {
                "nombre": "Galpón Zona Industrial Alejada",
                "descripcion": "Galpón en zona de difícil acceso",
                "perdidas": 6,
                "dias_disponible": 150,
            },
        ]
        
        for prop_data in propiedades_dificiles:
            # Crear propiedad disponible
            fecha_disponible = hoy - timedelta(days=prop_data["dias_disponible"])
            propiedad = Propiedad(
                nombre=prop_data["nombre"],
                descripcion=prop_data["descripcion"],
                tipo="oficina" if "Oficina" in prop_data["nombre"] else ("local" if "Local" in prop_data["nombre"] else ("departamento" if "Depto" in prop_data["nombre"] else "deposito")),
                direccion=f"Calle Ejemplo {random.randint(100, 9999)}",
                barrio="Centro",
                estado=EstadoPropiedad.DISPONIBLE.value,
                estado_fecha=fecha_disponible.date(),
                superficie=random.randint(30, 150),
                ambientes=random.randint(1, 3),
                precio_venta_estimado=Decimal(str(random.randint(80000, 250000))),
                valor_alquiler=Decimal(str(random.randint(500, 2500))),
                propietario=f"Propietario {random.choice(['García', 'Rodríguez', 'Fernández', 'López'])}",
            )
            session.add(propiedad)
            session.flush()
            
            # Crear oportunidades perdidas
            for i in range(prop_data["perdidas"]):
                # Distribuir las oportunidades perdidas en los últimos 2 años
                fecha_creacion = generar_fecha_aleatoria(hace_2_años, hoy)
                fecha_perdida = fecha_creacion + timedelta(days=random.randint(15, 60))
                
                oportunidad = CRMOportunidad(
                    contacto_id=random.choice(contactos).id,
                    tipo_operacion_id=random.choice(tipos_operacion).id,
                    propiedad_id=propiedad.id,
                    estado=EstadoOportunidad.PERDIDA.value,
                    fecha_estado=fecha_perdida,
                    motivo_perdida_id=random.choice(motivos_perdida).id if motivos_perdida else None,
                    monto=propiedad.valor_alquiler if random.random() > 0.3 else None,
                    moneda_id=moneda_usd.id if moneda_usd else None,
                    probabilidad=0,
                    fecha_cierre_estimada=(fecha_perdida + timedelta(days=30)).date(),
                    responsable_id=random.choice(usuarios).id,
                    descripcion_estado=f"Oportunidad perdida {i+1} - {random.choice(['Precio muy alto', 'Condiciones del inmueble', 'Ubicación', 'Requisitos del propietario'])}",
                    created_at=fecha_creacion,
                    updated_at=fecha_perdida,
                )
                session.add(oportunidad)
            
            session.commit()
            print(f"  ✅ {prop_data['nombre']}: {prop_data['perdidas']} oportunidades perdidas, disponible hace {prop_data['dias_disponible']} días")
        
        # ESCENARIO 2: Propiedades con pocas oportunidades perdidas
        print("\n" + "="*80)
        print("  ESCENARIO 2: Propiedades con pocas oportunidades perdidas")
        print("="*80)
        
        propiedades_pocas_perdidas = [
            {
                "nombre": "Oficina Palermo Luminosa",
                "descripcion": "Oficina moderna con excelente iluminación",
                "perdidas": 2,
                "dias_disponible": 45,
            },
            {
                "nombre": "Local Recoleta Bien Ubicado",
                "descripcion": "Local comercial en zona premium",
                "perdidas": 1,
                "dias_disponible": 30,
            },
            {
                "nombre": "Depto 2 amb Belgrano Precio Justo",
                "descripcion": "Departamento con buena relación precio-calidad",
                "perdidas": 3,
                "dias_disponible": 60,
            },
        ]
        
        for prop_data in propiedades_pocas_perdidas:
            fecha_disponible = hoy - timedelta(days=prop_data["dias_disponible"])
            propiedad = Propiedad(
                nombre=prop_data["nombre"],
                descripcion=prop_data["descripcion"],
                tipo="oficina" if "Oficina" in prop_data["nombre"] else ("local" if "Local" in prop_data["nombre"] else "departamento"),
                direccion=f"Av Principal {random.randint(100, 5000)}",
                barrio=random.choice(["Palermo", "Recoleta", "Belgrano"]),
                estado=EstadoPropiedad.DISPONIBLE.value,
                estado_fecha=fecha_disponible.date(),
                superficie=random.randint(40, 120),
                ambientes=random.randint(2, 4),
                precio_venta_estimado=Decimal(str(random.randint(150000, 350000))),
                valor_alquiler=Decimal(str(random.randint(800, 2000))),
                propietario=f"Propietario {random.choice(['Martínez', 'González', 'Sánchez', 'Pérez'])}",
            )
            session.add(propiedad)
            session.flush()
            
            for i in range(prop_data["perdidas"]):
                fecha_creacion = generar_fecha_aleatoria(hace_2_años, hoy)
                fecha_perdida = fecha_creacion + timedelta(days=random.randint(10, 30))
                
                oportunidad = CRMOportunidad(
                    contacto_id=random.choice(contactos).id,
                    tipo_operacion_id=random.choice(tipos_operacion).id,
                    propiedad_id=propiedad.id,
                    estado=EstadoOportunidad.PERDIDA.value,
                    fecha_estado=fecha_perdida,
                    motivo_perdida_id=random.choice(motivos_perdida).id if motivos_perdida else None,
                    monto=propiedad.valor_alquiler,
                    moneda_id=moneda_usd.id if moneda_usd else None,
                    probabilidad=0,
                    fecha_cierre_estimada=(fecha_perdida + timedelta(days=30)).date(),
                    responsable_id=random.choice(usuarios).id,
                    descripcion_estado=f"Oportunidad perdida {i+1}",
                    created_at=fecha_creacion,
                    updated_at=fecha_perdida,
                )
                session.add(oportunidad)
            
            session.commit()
            print(f"  ✅ {prop_data['nombre']}: {prop_data['perdidas']} oportunidades perdidas, disponible hace {prop_data['dias_disponible']} días")
        
        # ESCENARIO 3: Propiedades disponibles sin oportunidades (recién publicadas o sin interés)
        print("\n" + "="*80)
        print("  ESCENARIO 3: Propiedades sin oportunidades relacionadas")
        print("="*80)
        
        propiedades_sin_oportunidades = [
            {
                "nombre": "Oficina Nueva Puerto Madero",
                "descripcion": "Oficina recién terminada, sin mostrar aún",
                "dias_disponible": 5,
            },
            {
                "nombre": "Local Barrio Norte Reciente",
                "descripcion": "Local recientemente disponible",
                "dias_disponible": 10,
            },
            {
                "nombre": "Depto 3 amb Caballito Premium",
                "descripcion": "Departamento con amenities, recién publicado",
                "dias_disponible": 7,
            },
            {
                "nombre": "Cochera Microcentro Box Grande",
                "descripcion": "Cochera amplia sin interesados aún",
                "dias_disponible": 90,
            },
            {
                "nombre": "Galpón Zona Norte Industrial",
                "descripcion": "Galpón en zona industrial sin oportunidades",
                "dias_disponible": 120,
            },
        ]
        
        for prop_data in propiedades_sin_oportunidades:
            fecha_disponible = hoy - timedelta(days=prop_data["dias_disponible"])
            propiedad = Propiedad(
                nombre=prop_data["nombre"],
                descripcion=prop_data["descripcion"],
                tipo="oficina" if "Oficina" in prop_data["nombre"] else ("local" if "Local" in prop_data["nombre"] else ("cochera" if "Cochera" in prop_data["nombre"] else ("deposito" if "Galpón" in prop_data["nombre"] else "departamento"))),
                direccion=f"Calle Nueva {random.randint(100, 8000)}",
                barrio=random.choice(["Puerto Madero", "Barrio Norte", "Caballito", "Microcentro", "Zona Norte"]),
                estado=EstadoPropiedad.DISPONIBLE.value,
                estado_fecha=fecha_disponible.date(),
                superficie=random.randint(25, 200),
                ambientes=random.randint(1, 4),
                precio_venta_estimado=Decimal(str(random.randint(100000, 400000))),
                valor_alquiler=Decimal(str(random.randint(600, 3000))),
                propietario=f"Propietario {random.choice(['Álvarez', 'Torres', 'Ramírez', 'Flores'])}",
            )
            session.add(propiedad)
            session.commit()
            print(f"  ✅ {prop_data['nombre']}: sin oportunidades, disponible hace {prop_data['dias_disponible']} días")
        
        # ESCENARIO 4: Propiedades con diferentes antigüedades
        print("\n" + "="*80)
        print("  ESCENARIO 4: Propiedades con diferentes antigüedades de disponibilidad")
        print("="*80)
        
        antigüedades = [15, 30, 60, 90, 120, 180, 270, 365, 500, 730]
        for i, dias in enumerate(antigüedades, 1):
            fecha_disponible = hoy - timedelta(days=dias)
            perdidas = random.randint(0, dias // 60)  # Más antiguas pueden tener más perdidas
            
            propiedad = Propiedad(
                nombre=f"Propiedad Disponible Hace {dias} Días",
                descripcion=f"Propiedad con antigüedad de {dias} días",
                tipo=random.choice(["oficina", "local", "departamento", "cochera"]),
                direccion=f"Dirección Test {random.randint(1000, 9999)}",
                barrio=random.choice(["Centro", "Norte", "Sur", "Oeste"]),
                estado=EstadoPropiedad.DISPONIBLE.value,
                estado_fecha=fecha_disponible.date(),
                superficie=random.randint(30, 150),
                ambientes=random.randint(1, 4),
                precio_venta_estimado=Decimal(str(random.randint(80000, 300000))),
                valor_alquiler=Decimal(str(random.randint(500, 2500))),
                propietario=f"Propietario Test {i}",
            )
            session.add(propiedad)
            session.flush()
            
            # Crear oportunidades perdidas
            for j in range(perdidas):
                fecha_creacion = generar_fecha_aleatoria(fecha_disponible, hoy)
                fecha_perdida = fecha_creacion + timedelta(days=random.randint(10, 45))
                
                oportunidad = CRMOportunidad(
                    contacto_id=random.choice(contactos).id,
                    tipo_operacion_id=random.choice(tipos_operacion).id,
                    propiedad_id=propiedad.id,
                    estado=EstadoOportunidad.PERDIDA.value,
                    fecha_estado=fecha_perdida,
                    motivo_perdida_id=random.choice(motivos_perdida).id if motivos_perdida else None,
                    monto=propiedad.valor_alquiler if random.random() > 0.2 else None,
                    moneda_id=moneda_usd.id if moneda_usd else None,
                    probabilidad=0,
                    fecha_cierre_estimada=(fecha_perdida + timedelta(days=30)).date(),
                    responsable_id=random.choice(usuarios).id,
                    descripcion_estado=f"Oportunidad perdida {j+1}",
                    created_at=fecha_creacion,
                    updated_at=fecha_perdida,
                )
                session.add(oportunidad)
            
            session.commit()
            print(f"  ✅ Propiedad {i}: {perdidas} oportunidades perdidas, disponible hace {dias} días")
        
        print("\n" + "="*80)
        print("  ✅ POBLACIÓN COMPLETADA EXITOSAMENTE")
        print("="*80)
        print(f"\nTotal de propiedades disponibles creadas:")
        print(f"  - 4 propiedades difíciles (muchas perdidas)")
        print(f"  - 3 propiedades con pocas perdidas")
        print(f"  - 5 propiedades sin oportunidades")
        print(f"  - 10 propiedades con diferentes antigüedades")
        print(f"  TOTAL: 22 propiedades disponibles")
        print("="*80 + "\n")


if __name__ == "__main__":
    main()
