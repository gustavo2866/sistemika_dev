"""
Script 04: Crear 20 propiedades ficticias con múltiples ciclos de vacancia.

Este script crea propiedades de prueba con diferentes estados y ciclos de vacancia
para demostrar el funcionamiento del sistema de seguimiento de vacancia.

Incluye:
- 20 propiedades con datos realistas
- Múltiples ciclos de vacancia (activos y cerrados)
- Diferentes duraciones de reparación y disponibilidad
- Casos de prueba para todas las transiciones de estado

Ejecutar SOLO en base de datos de desarrollo/testing.

NOTA: Los errores de import de Pylance son normales porque este script
está fuera del directorio backend. El script funciona correctamente cuando
se ejecuta desde la terminal con:
    cd backend
    python ..\doc\03-devs\20251114-propiedades-vacancia\04-seed_propiedades_ficticias.py
"""

import sys
import os
from datetime import datetime, timedelta
from random import randint, choice, uniform

# Agregar path del backend al PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')))

from sqlmodel import Session, select, text

from sqlmodel import Session, select
from app.db import engine
from app.models.propiedad import Propiedad
from app.models.vacancia import Vacancia


# Datos ficticios para generar propiedades
TIPOS_PROPIEDAD = ['Casa', 'Departamento', 'Local Comercial', 'Oficina', 'Terreno', 'Depósito', 'Cochera']
PROPIETARIOS = [
    'Juan Pérez', 'María González', 'Pedro Rodríguez', 'Ana Martínez',
    'Carlos López', 'Laura Fernández', 'Diego Sánchez', 'Sofía Torres',
    'Martín Silva', 'Valentina Castro', 'Lucas Romero', 'Camila Díaz',
    'Facundo Morales', 'Florencia Ruiz', 'Nicolás Alvarez'
]
CALLES = [
    'San Martín', 'Belgrano', 'Rivadavia', 'Mitre', 'Sarmiento',
    'Corrientes', '9 de Julio', 'Independencia', 'Libertad', 'Maipú',
    'Córdoba', 'Santa Fe', 'Tucumán', 'Mendoza', 'Entre Ríos'
]
BARRIOS = [
    'Centro', 'Palermo', 'Recoleta', 'Belgrano', 'Caballito',
    'Villa Crespo', 'Almagro', 'Flores', 'Microcentro', 'Puerto Madero'
]


def generar_nombre_propiedad(tipo: str, idx: int) -> str:
    """Genera un nombre descriptivo para la propiedad."""
    if tipo == 'Casa':
        return f"Casa {choice(CALLES)} {randint(100, 9999)}"
    elif tipo == 'Departamento':
        return f"Depto {choice(BARRIOS)} {randint(1, 20)}° {choice(['A', 'B', 'C', 'D'])}"
    elif tipo == 'Local Comercial':
        return f"Local {choice(CALLES)} {randint(100, 999)}"
    elif tipo == 'Oficina':
        return f"Oficina {choice(BARRIOS)} Piso {randint(1, 15)}"
    elif tipo == 'Terreno':
        return f"Terreno {choice(CALLES)} Lote {randint(1, 50)}"
    elif tipo == 'Depósito':
        return f"Depósito {choice(BARRIOS)} {randint(1, 100)}"
    else:  # Cochera
        return f"Cochera {choice(BARRIOS)} Box {randint(1, 150)}"


def generar_propiedad_ficticia(idx: int) -> dict:
    """Genera datos ficticios para una propiedad."""
    tipo = choice(TIPOS_PROPIEDAD)
    
    # Valores según tipo
    if tipo == 'Casa':
        ambientes = randint(2, 5)
        metros = round(uniform(80, 250), 2)
        valor_alquiler = round(uniform(150000, 400000), 2)
        expensas = round(uniform(15000, 35000), 2)
    elif tipo == 'Departamento':
        ambientes = randint(1, 4)
        metros = round(uniform(35, 120), 2)
        valor_alquiler = round(uniform(100000, 300000), 2)
        expensas = round(uniform(20000, 50000), 2)
    elif tipo == 'Local Comercial':
        ambientes = randint(1, 3)
        metros = round(uniform(30, 200), 2)
        valor_alquiler = round(uniform(200000, 600000), 2)
        expensas = round(uniform(30000, 80000), 2)
    elif tipo == 'Oficina':
        ambientes = randint(1, 6)
        metros = round(uniform(40, 150), 2)
        valor_alquiler = round(uniform(120000, 350000), 2)
        expensas = round(uniform(25000, 60000), 2)
    elif tipo == 'Terreno':
        ambientes = None
        metros = round(uniform(200, 1500), 2)
        valor_alquiler = round(uniform(50000, 200000), 2)
        expensas = None
    elif tipo == 'Depósito':
        ambientes = None
        metros = round(uniform(50, 500), 2)
        valor_alquiler = round(uniform(80000, 250000), 2)
        expensas = round(uniform(10000, 30000), 2)
    else:  # Cochera
        ambientes = None
        metros = round(uniform(12, 25), 2)
        valor_alquiler = round(uniform(30000, 80000), 2)
        expensas = round(uniform(5000, 15000), 2)
    
    # Estados posibles con probabilidades diferentes
    estados_probabilidad = [
        ('1-recibida', 0.15),
        ('2-en_reparacion', 0.20),
        ('3-disponible', 0.30),
        ('4-alquilada', 0.30),
        ('5-retirada', 0.05)
    ]
    
    # Selección ponderada del estado
    rand = uniform(0, 1)
    acumulado = 0
    estado = '1-recibida'
    for est, prob in estados_probabilidad:
        acumulado += prob
        if rand <= acumulado:
            estado = est
            break
    
    return {
        'nombre': generar_nombre_propiedad(tipo, idx),
        'tipo': tipo,
        'propietario': choice(PROPIETARIOS),
        'estado': estado,
        'ambientes': ambientes,
        'metros_cuadrados': metros,
        'valor_alquiler': valor_alquiler,
        'expensas': expensas,
        'fecha_ingreso': datetime.utcnow() - timedelta(days=randint(30, 730)),  # Entre 1 mes y 2 años atrás
        'estado_fecha': datetime.utcnow() - timedelta(days=randint(1, 90)),  # Último cambio en últimos 3 meses
        'estado_comentario': choice([
            'Propiedad en buen estado',
            'Requiere mejoras menores',
            'Pintura necesaria',
            'Instalaciones actualizadas',
            'Propiedad lista para ocupar',
            None
        ])
    }


def generar_ciclos_vacancia(propiedad_id: int, estado_actual: str, fecha_ingreso: datetime) -> list:
    """Genera uno o más ciclos de vacancia para una propiedad."""
    ciclos = []
    
    # Determinar cantidad de ciclos según estado
    if estado_actual == '4-alquilada':
        # Propiedades alquiladas pueden tener 1-3 ciclos cerrados
        num_ciclos = randint(1, 3)
    elif estado_actual == '5-retirada':
        # Propiedades retiradas tienen 1-2 ciclos cerrados
        num_ciclos = randint(1, 2)
    else:
        # Propiedades activas tienen 0-1 ciclos cerrados + 1 activo
        num_ciclos_cerrados = randint(0, 1)
        num_ciclos = num_ciclos_cerrados + 1  # + ciclo activo
    
    fecha_base = fecha_ingreso
    
    for i in range(num_ciclos):
        es_ultimo_ciclo = (i == num_ciclos - 1)
        es_ciclo_activo = es_ultimo_ciclo and estado_actual not in ['4-alquilada', '5-retirada']
        
        # Fecha de inicio del ciclo
        fecha_recibida = fecha_base + timedelta(days=randint(0, 5))
        
        # Duración de reparación (0-60 días, o None si no hubo reparación)
        tiene_reparacion = choice([True, True, False])  # 66% tienen reparación
        if tiene_reparacion:
            dias_reparacion = randint(3, 60)
            fecha_en_reparacion = fecha_recibida + timedelta(days=randint(0, 3))
            fecha_disponible = fecha_en_reparacion + timedelta(days=dias_reparacion)
        else:
            fecha_en_reparacion = None
            fecha_disponible = fecha_recibida + timedelta(days=randint(1, 7))
        
        # Duración disponible (5-120 días)
        dias_disponible = randint(5, 120)
        
        ciclo = {
            'propiedad_id': propiedad_id,
            'fecha_recibida': fecha_recibida,
            'comentario_recibida': choice([
                'Propiedad recibida en buenas condiciones',
                'Inicio de ciclo de vacancia',
                'Recibida del propietario',
                'Finalización de contrato anterior',
                None
            ])
        }
        
        if fecha_en_reparacion:
            ciclo['fecha_en_reparacion'] = fecha_en_reparacion
            ciclo['comentario_en_reparacion'] = choice([
                'Pintura general',
                'Reparación de instalaciones',
                'Mantenimiento preventivo',
                'Arreglos menores',
                'Limpieza profunda y pintura',
                None
            ])
        
        ciclo['fecha_disponible'] = fecha_disponible
        ciclo['comentario_disponible'] = choice([
            'Lista para mostrar',
            'Disponible para alquilar',
            'Propiedad en perfectas condiciones',
            'Publicada en portales',
            None
        ])
        
        # Si es ciclo cerrado, agregar fecha de cierre
        if not es_ciclo_activo:
            if estado_actual == '5-retirada' and es_ultimo_ciclo:
                # Último ciclo cerrado por retiro
                fecha_retirada = fecha_disponible + timedelta(days=randint(1, 30))
                ciclo['fecha_retirada'] = fecha_retirada
                ciclo['comentario_retirada'] = choice([
                    'Propiedad retirada del mercado',
                    'Propietario decidió no alquilar',
                    'Cambio de destino',
                    None
                ])
                ciclo['ciclo_activo'] = False
                
                # Calcular métricas
                if fecha_en_reparacion:
                    ciclo['dias_reparacion'] = (fecha_disponible - fecha_en_reparacion).days
                ciclo['dias_disponible'] = (fecha_retirada - fecha_disponible).days
                ciclo['dias_totales'] = (fecha_retirada - fecha_recibida).days
                
                fecha_base = fecha_retirada
            else:
                # Ciclo cerrado por alquiler
                fecha_alquilada = fecha_disponible + timedelta(days=dias_disponible)
                ciclo['fecha_alquilada'] = fecha_alquilada
                ciclo['comentario_alquilada'] = choice([
                    'Alquilada exitosamente',
                    'Contrato firmado',
                    'Inquilino ingresado',
                    'Cierre de ciclo de vacancia',
                    None
                ])
                ciclo['ciclo_activo'] = False
                
                # Calcular métricas
                if fecha_en_reparacion:
                    ciclo['dias_reparacion'] = (fecha_disponible - fecha_en_reparacion).days
                ciclo['dias_disponible'] = dias_disponible
                ciclo['dias_totales'] = (fecha_alquilada - fecha_recibida).days
                
                # Si hubo alquiler, agregar duración del contrato antes del próximo ciclo
                duracion_contrato = randint(180, 730)  # 6 meses a 2 años
                fecha_base = fecha_alquilada + timedelta(days=duracion_contrato)
        else:
            # Ciclo activo (no tiene fecha de cierre)
            ciclo['ciclo_activo'] = True
        
        ciclos.append(ciclo)
    
    return ciclos


def seed_propiedades_ficticias():
    """Crea 20 propiedades ficticias con múltiples ciclos de vacancia."""
    
    print("\n" + "="*60)
    print("SCRIPT 04: Crear propiedades ficticias con vacancias")
    print("="*60)
    print("\n⚠️  ADVERTENCIA: Este script es para DESARROLLO/TESTING")
    print("    NO ejecutar en base de datos de producción\n")
    
    with Session(engine) as session:
        # Verificar propiedades existentes
        statement_count = select(Propiedad).where(Propiedad.deleted_at.is_(None))
        propiedades_existentes = session.exec(statement_count).all()
        
        if len(propiedades_existentes) > 0:
            print(f"⚠️  Hay {len(propiedades_existentes)} propiedades existentes en la BD")
            print("   Las nuevas propiedades se agregarán a las existentes")
            
            # Corregir secuencia de IDs
            max_id = max([p.id for p in propiedades_existentes])
            print(f"   Ajustando secuencia de IDs desde {max_id}...")
            session.execute(text(f"SELECT setval('propiedades_id_seq', {max_id}, true)"))
            session.commit()
            print("   ✅ Secuencia ajustada\n")
        
        propiedades_creadas = 0
        vacancias_creadas = 0
        
        for i in range(1, 21):
            # Generar datos de propiedad (sin especificar ID, se auto-genera)
            prop_data = generar_propiedad_ficticia(i)
            
            # Crear propiedad
            propiedad = Propiedad(**prop_data)
            session.add(propiedad)
            session.flush()  # Para obtener el ID auto-generado
            
            print(f"\n📦 Propiedad {i}/20: {propiedad.nombre}")
            print(f"   Tipo: {propiedad.tipo} | Estado: {propiedad.estado}")
            print(f"   {propiedad.ambientes or 0} amb | {propiedad.metros_cuadrados} m²")
            print(f"   Alquiler: ${propiedad.valor_alquiler:,.0f}")
            
            propiedades_creadas += 1
            
            # Generar ciclos de vacancia
            ciclos = generar_ciclos_vacancia(
                propiedad.id,
                propiedad.estado,
                propiedad.fecha_ingreso
            )
            
            print(f"   📊 Ciclos de vacancia: {len(ciclos)}")
            
            for idx, ciclo_data in enumerate(ciclos, 1):
                vacancia = Vacancia(**ciclo_data)
                session.add(vacancia)
                vacancias_creadas += 1
                
                estado = "ACTIVO" if ciclo_data['ciclo_activo'] else "CERRADO"
                if ciclo_data.get('fecha_alquilada'):
                    dias = ciclo_data.get('dias_totales', 0)
                    print(f"      {idx}. {estado} - Alquilada ({dias} días totales)")
                elif ciclo_data.get('fecha_retirada'):
                    dias = ciclo_data.get('dias_totales', 0)
                    print(f"      {idx}. {estado} - Retirada ({dias} días totales)")
                else:
                    print(f"      {idx}. {estado} - En curso")
        
        # Guardar cambios
        session.commit()
        
        # Resumen
        print("\n" + "-"*60)
        print("RESUMEN:")
        print(f"  Propiedades creadas: {propiedades_creadas}")
        print(f"  Vacancias creadas: {vacancias_creadas}")
        print(f"  Promedio ciclos por propiedad: {vacancias_creadas/propiedades_creadas:.1f}")
        
        # Contar por estado
        statement = select(Propiedad).where(Propiedad.deleted_at.is_(None))
        todas = session.exec(statement).all()
        
        print(f"\nDistribución por estado:")
        for estado in ['1-recibida', '2-en_reparacion', '3-disponible', '4-alquilada', '5-retirada']:
            count = len([p for p in todas if p.estado == estado])
            print(f"  {estado}: {count}")
        
        print("-"*60)
        print("✅ Seed de propiedades ficticias completado exitosamente\n")


if __name__ == "__main__":
    try:
        # Verificar si se pasó --confirm como argumento
        auto_confirm = '--confirm' in sys.argv or '-y' in sys.argv
        
        if not auto_confirm:
            # Confirmación de seguridad
            print("\n" + "="*60)
            print("⚠️  CONFIRMACIÓN DE SEGURIDAD")
            print("="*60)
            print("\nEste script creará 20 propiedades ficticias con vacancias.")
            print("Solo debe ejecutarse en base de datos de DESARROLLO.")
            print("\n¿Desea continuar? (escriba 'SI' para confirmar)")
            print("O ejecute con: python script.py --confirm")
            
            confirmacion = input("\n> ").strip().upper()
            
            if confirmacion != 'SI':
                print("\n❌ Operación cancelada por el usuario\n")
                sys.exit(0)
        
        seed_propiedades_ficticias()
            
    except Exception as e:
        print(f"\n❌ Error durante el seed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
