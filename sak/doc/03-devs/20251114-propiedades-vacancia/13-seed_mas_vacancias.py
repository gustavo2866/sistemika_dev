"""
Script para generar más propiedades y vacancias con escenarios diversos.

Escenarios a cubrir:
1. Ciclos muy cortos (1-7 días)
2. Ciclos muy largos (>365 días)
3. Vacancias con mucho tiempo en reparación
4. Vacancias con poco tiempo en reparación
5. Propiedades retiradas
6. Múltiples ciclos de la misma propiedad
7. Propiedades de distintos tipos y ambientes
8. Distintos propietarios
9. Fechas distribuidas en varios años
10. Vacancias activas en distintos estados

Ejecutar:
    cd backend
    python ..\doc\03-devs\20251114-propiedades-vacancia\13-seed_mas_vacancias.py
"""

import sys
import os
from datetime import datetime, timedelta
from random import choice, randint, uniform
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend'))

from app.db import get_session
from app.models.propiedad import Propiedad
from app.models.vacancia import Vacancia
from sqlmodel import select, func, text

# Configuración
random.seed(42)  # Para reproducibilidad

# Datos de prueba
PROPIETARIOS = [
    "María González", "Juan Pérez", "Ana Martínez", "Carlos López",
    "Laura Fernández", "Roberto Silva", "Patricia Rodríguez", "Diego Torres",
    "Sofía Ramírez", "Miguel Castro", "Valentina Morales", "Andrés Ruiz"
]

TIPOS = ["departamento", "casa", "local", "oficina", "cochera", "deposito"]

DIRECCIONES = [
    "Corrientes 1234", "Santa Fe 5678", "Córdoba 9012", "Belgrano 3456",
    "San Martín 7890", "Rivadavia 2345", "Maipú 6789", "Florida 1234",
    "Lavalle 5678", "Paraguay 9012", "Uruguay 3456", "Reconquista 7890",
    "Suipacha 2345", "Esmeralda 6789", "Libertad 1234", "Cerrito 5678",
    "Callao 9012", "Rodríguez Peña 3456", "Montevideo 7890", "Pueyrredón 2345",
    "Scalabrini Ortiz 6789", "Juan B. Justo 1234", "Warnes 5678", "Dorrego 9012",
    "Cabildo 3456", "Monroe 7890", "Del Libertador 2345", "Figueroa Alcorta 6789",
    "Las Heras 1234", "Juncal 5678"
]

def crear_propiedad(session, nombre: str, tipo: str, propietario: str, direccion: str, 
                    ambientes: int, metros: int, estado: str) -> Propiedad:
    """Crea una propiedad."""
    propiedad = Propiedad(
        nombre=nombre,
        tipo=tipo,
        propietario=propietario,
        direccion=direccion,
        ambientes=ambientes,
        metros_cuadrados=metros,
        valor_alquiler=ambientes * 80000 + randint(-20000, 30000),
        expensas=ambientes * 15000 + randint(-5000, 8000),
        fecha_ingreso=datetime.now() - timedelta(days=randint(100, 2000)),
        vencimiento_contrato=None,
        estado=estado,
        estado_fecha=datetime.now(),
        estado_comentario=f"Propiedad {estado.split('-')[1]} generada para testing"
    )
    session.add(propiedad)
    session.flush()
    return propiedad


def crear_vacancia(session, propiedad_id: int, fecha_inicio: datetime, 
                   duracion_reparacion: int, duracion_disponible: int,
                   cerrada: bool = False, retirada: bool = False) -> Vacancia:
    """Crea una vacancia con fechas calculadas."""
    
    fecha_recibida = fecha_inicio
    fecha_en_reparacion = None
    fecha_disponible = None
    fecha_alquilada = None
    fecha_retirada = None
    
    # Calcular fechas según duración
    if duracion_reparacion > 0:
        fecha_en_reparacion = fecha_recibida + timedelta(hours=2)
        fecha_disponible = fecha_en_reparacion + timedelta(days=duracion_reparacion)
    else:
        fecha_disponible = fecha_recibida + timedelta(hours=1)
    
    if cerrada:
        if retirada:
            fecha_retirada = fecha_disponible + timedelta(days=duracion_disponible)
        else:
            fecha_alquilada = fecha_disponible + timedelta(days=duracion_disponible)
    
    # Calcular métricas si está cerrada
    dias_reparacion = duracion_reparacion if cerrada else None
    dias_disponible = duracion_disponible if cerrada else None
    dias_totales = (duracion_reparacion + duracion_disponible) if cerrada else None
    
    vacancia = Vacancia(
        propiedad_id=propiedad_id,
        ciclo_activo=not cerrada,
        fecha_recibida=fecha_recibida,
        comentario_recibida="Vacancia generada para testing",
        fecha_en_reparacion=fecha_en_reparacion,
        comentario_en_reparacion="En reparación" if fecha_en_reparacion else None,
        fecha_disponible=fecha_disponible,
        comentario_disponible="Disponible para alquilar",
        fecha_alquilada=fecha_alquilada,
        comentario_alquilada="Alquilada" if fecha_alquilada else None,
        fecha_retirada=fecha_retirada,
        comentario_retirada="Retirada del sistema" if fecha_retirada else None,
        dias_reparacion=dias_reparacion,
        dias_disponible=dias_disponible,
        dias_totales=dias_totales
    )
    
    session.add(vacancia)
    session.flush()
    return vacancia


def main():
    print("🏗️  Generando más propiedades y vacancias para testing\n")
    
    for session in get_session():
        # Obtener ID máximo actual
        max_id = session.exec(select(func.max(Propiedad.id))).one() or 0
        print(f"📊 ID máximo actual de propiedades: {max_id}")
        
        # Resetear secuencia
        session.exec(text(f"SELECT setval('propiedades_id_seq', {max_id}, true)"))
        print(f"✅ Secuencia ajustada a {max_id}\n")
        
        propiedades_creadas = []
        vacancias_creadas = []
        
        # Escenario 1: Ciclos muy cortos (1-7 días) - 5 propiedades
        print("📦 Escenario 1: Ciclos muy cortos (1-7 días)")
        for i in range(5):
            prop = crear_propiedad(
                session,
                nombre=f"Depto Microestadía {i+1}",
                tipo="departamento",
                propietario=choice(PROPIETARIOS),
                direccion=choice(DIRECCIONES),
                ambientes=randint(1, 2),
                metros=randint(25, 45),
                estado="4-alquilada"
            )
            propiedades_creadas.append(prop)
            
            # 2-3 ciclos cortos cerrados
            fecha_base = datetime.now() - timedelta(days=randint(60, 300))
            for _ in range(randint(2, 3)):
                vac = crear_vacancia(
                    session,
                    propiedad_id=prop.id,
                    fecha_inicio=fecha_base,
                    duracion_reparacion=randint(0, 2),
                    duracion_disponible=randint(1, 7),
                    cerrada=True
                )
                vacancias_creadas.append(vac)
                fecha_base += timedelta(days=randint(10, 30))
        
        print(f"  ✅ Creadas {len(propiedades_creadas)} propiedades con ciclos cortos\n")
        
        # Escenario 2: Ciclos muy largos (>365 días) - 3 propiedades
        print("📦 Escenario 2: Ciclos muy largos (>365 días)")
        inicio_anterior = len(propiedades_creadas)
        for i in range(3):
            prop = crear_propiedad(
                session,
                nombre=f"Local Grande {i+1}",
                tipo="local",
                propietario=choice(PROPIETARIOS),
                direccion=choice(DIRECCIONES),
                ambientes=randint(3, 5),
                metros=randint(100, 250),
                estado="3-disponible"
            )
            propiedades_creadas.append(prop)
            
            # 1 ciclo muy largo activo
            fecha_inicio = datetime.now() - timedelta(days=randint(400, 800))
            vac = crear_vacancia(
                session,
                propiedad_id=prop.id,
                fecha_inicio=fecha_inicio,
                duracion_reparacion=randint(30, 90),
                duracion_disponible=0,  # Sigue disponible
                cerrada=False
            )
            vacancias_creadas.append(vac)
        
        print(f"  ✅ Creadas {len(propiedades_creadas) - inicio_anterior} propiedades con ciclos largos\n")
        
        # Escenario 3: Mucho tiempo en reparación - 4 propiedades
        print("📦 Escenario 3: Mucho tiempo en reparación")
        inicio_anterior = len(propiedades_creadas)
        for i in range(4):
            prop = crear_propiedad(
                session,
                nombre=f"Casa en Remodelación {i+1}",
                tipo="casa",
                propietario=choice(PROPIETARIOS),
                direccion=choice(DIRECCIONES),
                ambientes=randint(3, 4),
                metros=randint(80, 150),
                estado="2-en_reparacion"
            )
            propiedades_creadas.append(prop)
            
            # Ciclo con mucha reparación
            vac = crear_vacancia(
                session,
                propiedad_id=prop.id,
                fecha_inicio=datetime.now() - timedelta(days=randint(120, 200)),
                duracion_reparacion=randint(90, 180),
                duracion_disponible=0,
                cerrada=False
            )
            vacancias_creadas.append(vac)
        
        print(f"  ✅ Creadas {len(propiedades_creadas) - inicio_anterior} propiedades en reparación larga\n")
        
        # Escenario 4: Poco o nada de reparación - 5 propiedades
        print("📦 Escenario 4: Poco o nada de reparación")
        inicio_anterior = len(propiedades_creadas)
        for i in range(5):
            prop = crear_propiedad(
                session,
                nombre=f"Oficina Lista {i+1}",
                tipo="oficina",
                propietario=choice(PROPIETARIOS),
                direccion=choice(DIRECCIONES),
                ambientes=randint(2, 3),
                metros=randint(40, 80),
                estado="4-alquilada"
            )
            propiedades_creadas.append(prop)
            
            # 1-2 ciclos sin o con poca reparación
            fecha_base = datetime.now() - timedelta(days=randint(100, 250))
            for _ in range(randint(1, 2)):
                vac = crear_vacancia(
                    session,
                    propiedad_id=prop.id,
                    fecha_inicio=fecha_base,
                    duracion_reparacion=randint(0, 3),
                    duracion_disponible=randint(15, 60),
                    cerrada=True
                )
                vacancias_creadas.append(vac)
                fecha_base += timedelta(days=randint(80, 150))
        
        print(f"  ✅ Creadas {len(propiedades_creadas) - inicio_anterior} propiedades sin reparación\n")
        
        # Escenario 5: Propiedades retiradas - 3 propiedades
        print("📦 Escenario 5: Propiedades retiradas")
        inicio_anterior = len(propiedades_creadas)
        for i in range(3):
            prop = crear_propiedad(
                session,
                nombre=f"Propiedad Retirada {i+1}",
                tipo=choice(["departamento", "casa"]),
                propietario=choice(PROPIETARIOS),
                direccion=choice(DIRECCIONES),
                ambientes=randint(1, 3),
                metros=randint(40, 90),
                estado="5-retirada"
            )
            propiedades_creadas.append(prop)
            
            # 1 ciclo cerrado por retiro
            vac = crear_vacancia(
                session,
                propiedad_id=prop.id,
                fecha_inicio=datetime.now() - timedelta(days=randint(80, 150)),
                duracion_reparacion=randint(5, 30),
                duracion_disponible=randint(20, 60),
                cerrada=True,
                retirada=True
            )
            vacancias_creadas.append(vac)
        
        print(f"  ✅ Creadas {len(propiedades_creadas) - inicio_anterior} propiedades retiradas\n")
        
        # Escenario 6: Múltiples ciclos históricos - 5 propiedades
        print("📦 Escenario 6: Propiedades con múltiples ciclos históricos")
        inicio_anterior = len(propiedades_creadas)
        for i in range(5):
            prop = crear_propiedad(
                session,
                nombre=f"Depto Alta Rotación {i+1}",
                tipo="departamento",
                propietario=choice(PROPIETARIOS),
                direccion=choice(DIRECCIONES),
                ambientes=randint(2, 3),
                metros=randint(50, 75),
                estado="4-alquilada"
            )
            propiedades_creadas.append(prop)
            
            # 4-6 ciclos históricos
            fecha_base = datetime.now() - timedelta(days=randint(500, 700))
            for j in range(randint(4, 6)):
                vac = crear_vacancia(
                    session,
                    propiedad_id=prop.id,
                    fecha_inicio=fecha_base,
                    duracion_reparacion=randint(3, 15),
                    duracion_disponible=randint(20, 90),
                    cerrada=True
                )
                vacancias_creadas.append(vac)
                fecha_base += timedelta(days=randint(100, 200))
        
        print(f"  ✅ Creadas {len(propiedades_creadas) - inicio_anterior} propiedades con múltiples ciclos\n")
        
        # Escenario 7: Distintos tipos y ambientes - 8 propiedades
        print("📦 Escenario 7: Variedad de tipos y ambientes")
        inicio_anterior = len(propiedades_creadas)
        tipos_especiales = [
            ("cochera", 0, 12, "3-disponible"),
            ("cochera", 0, 15, "4-alquilada"),
            ("deposito", 0, 50, "3-disponible"),
            ("deposito", 0, 80, "2-en_reparacion"),
            ("departamento", 1, 30, "3-disponible"),
            ("departamento", 5, 180, "4-alquilada"),
            ("casa", 6, 250, "3-disponible"),
            ("local", 1, 120, "2-en_reparacion"),
        ]
        
        for i, (tipo, ambientes, metros, estado) in enumerate(tipos_especiales):
            prop = crear_propiedad(
                session,
                nombre=f"{tipo.title()} Especial {i+1}",
                tipo=tipo,
                propietario=choice(PROPIETARIOS),
                direccion=choice(DIRECCIONES),
                ambientes=ambientes,
                metros=metros,
                estado=estado
            )
            propiedades_creadas.append(prop)
            
            # 1-2 vacancias
            fecha_base = datetime.now() - timedelta(days=randint(50, 300))
            for _ in range(randint(1, 2)):
                cerrada = estado == "4-alquilada"
                vac = crear_vacancia(
                    session,
                    propiedad_id=prop.id,
                    fecha_inicio=fecha_base,
                    duracion_reparacion=randint(0, 30),
                    duracion_disponible=randint(15, 120),
                    cerrada=cerrada
                )
                vacancias_creadas.append(vac)
                if cerrada:
                    fecha_base += timedelta(days=randint(150, 300))
        
        print(f"  ✅ Creadas {len(propiedades_creadas) - inicio_anterior} propiedades variadas\n")
        
        # Escenario 8: Distribución temporal amplia - 6 propiedades
        print("📦 Escenario 8: Vacancias en distintos años")
        inicio_anterior = len(propiedades_creadas)
        años = [2022, 2023, 2024, 2025, 2026]
        for i, año in enumerate(años[:6]):
            prop = crear_propiedad(
                session,
                nombre=f"Propiedad Año {año}",
                tipo=choice(["departamento", "casa"]),
                propietario=choice(PROPIETARIOS),
                direccion=choice(DIRECCIONES),
                ambientes=randint(2, 3),
                metros=randint(60, 100),
                estado=choice(["3-disponible", "4-alquilada"])
            )
            propiedades_creadas.append(prop)
            
            # 1-2 vacancias en ese año
            mes = randint(1, 12)
            día = randint(1, 28)
            fecha_inicio = datetime(año, mes, día)
            
            # Solo crear si no es futuro
            if fecha_inicio <= datetime.now():
                cerrada = prop.estado == "4-alquilada"
                vac = crear_vacancia(
                    session,
                    propiedad_id=prop.id,
                    fecha_inicio=fecha_inicio,
                    duracion_reparacion=randint(5, 45),
                    duracion_disponible=randint(30, 150),
                    cerrada=cerrada
                )
                vacancias_creadas.append(vac)
        
        print(f"  ✅ Creadas {len(propiedades_creadas) - inicio_anterior} propiedades con vacancias en distintos años\n")
        
        # Commit
        session.commit()
        
        print(f"\n{'='*60}")
        print(f"✅ Generación completada exitosamente")
        print(f"{'='*60}")
        print(f"📊 Total propiedades creadas: {len(propiedades_creadas)}")
        print(f"📊 Total vacancias creadas: {len(vacancias_creadas)}")
        print(f"\n🎯 Escenarios cubiertos:")
        print(f"   1. Ciclos cortos (1-7 días)")
        print(f"   2. Ciclos largos (>365 días)")
        print(f"   3. Mucha reparación (90-180 días)")
        print(f"   4. Poca/sin reparación (0-3 días)")
        print(f"   5. Propiedades retiradas")
        print(f"   6. Múltiples ciclos históricos (4-6 ciclos)")
        print(f"   7. Variedad de tipos y ambientes")
        print(f"   8. Distribución temporal amplia (2022-2026)")
        print(f"\n💾 Datos guardados en la base de datos")

if __name__ == "__main__":
    main()
