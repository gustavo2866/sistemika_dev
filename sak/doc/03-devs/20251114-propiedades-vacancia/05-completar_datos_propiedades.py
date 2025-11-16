"""
Script 05: Completar datos faltantes en propiedades existentes.

Este script actualiza las propiedades que tienen campos NULL con valores
realistas según su tipo. Útil para propiedades creadas antes de agregar
los nuevos campos.

Campos a completar:
- ambientes
- metros_cuadrados
- valor_alquiler
- expensas
- fecha_ingreso (si es NULL)

NOTA: Los errores de import de Pylance son normales porque este script
está fuera del directorio backend. El script funciona correctamente cuando
se ejecuta desde la terminal con:
    cd backend
    python ..\doc\03-devs\20251114-propiedades-vacancia\05-completar_datos_propiedades.py
"""

import sys
import os
from datetime import datetime, timedelta
from random import randint, uniform

# Agregar path del backend al PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend')))

from sqlmodel import Session, select
from app.db import engine
from app.models.propiedad import Propiedad


def generar_datos_por_tipo(tipo: str) -> dict:
    """Genera datos realistas según el tipo de propiedad."""
    
    datos = {}
    
    if tipo == 'Casa':
        datos['ambientes'] = randint(2, 5)
        datos['metros_cuadrados'] = round(uniform(80, 250), 2)
        datos['valor_alquiler'] = round(uniform(150000, 400000), 2)
        datos['expensas'] = round(uniform(15000, 35000), 2)
    
    elif tipo == 'Departamento':
        datos['ambientes'] = randint(1, 4)
        datos['metros_cuadrados'] = round(uniform(35, 120), 2)
        datos['valor_alquiler'] = round(uniform(100000, 300000), 2)
        datos['expensas'] = round(uniform(20000, 50000), 2)
    
    elif tipo == 'Local Comercial' or tipo == 'Local':
        datos['ambientes'] = randint(1, 3)
        datos['metros_cuadrados'] = round(uniform(30, 200), 2)
        datos['valor_alquiler'] = round(uniform(200000, 600000), 2)
        datos['expensas'] = round(uniform(30000, 80000), 2)
    
    elif tipo == 'Oficina':
        datos['ambientes'] = randint(1, 6)
        datos['metros_cuadrados'] = round(uniform(40, 150), 2)
        datos['valor_alquiler'] = round(uniform(120000, 350000), 2)
        datos['expensas'] = round(uniform(25000, 60000), 2)
    
    elif tipo == 'Terreno':
        datos['ambientes'] = None  # Los terrenos no tienen ambientes
        datos['metros_cuadrados'] = round(uniform(200, 1500), 2)
        datos['valor_alquiler'] = round(uniform(50000, 200000), 2)
        datos['expensas'] = None  # Los terrenos generalmente no tienen expensas
    
    elif tipo == 'Depósito' or tipo == 'Deposito':
        datos['ambientes'] = None  # Los depósitos no tienen ambientes habitables
        datos['metros_cuadrados'] = round(uniform(50, 500), 2)
        datos['valor_alquiler'] = round(uniform(80000, 250000), 2)
        datos['expensas'] = round(uniform(10000, 30000), 2)
    
    elif tipo == 'Cochera':
        datos['ambientes'] = None  # Las cocheras no tienen ambientes
        datos['metros_cuadrados'] = round(uniform(12, 25), 2)
        datos['valor_alquiler'] = round(uniform(30000, 80000), 2)
        datos['expensas'] = round(uniform(5000, 15000), 2)
    
    else:
        # Tipo desconocido - valores genéricos
        datos['ambientes'] = randint(1, 3)
        datos['metros_cuadrados'] = round(uniform(50, 150), 2)
        datos['valor_alquiler'] = round(uniform(100000, 300000), 2)
        datos['expensas'] = round(uniform(15000, 40000), 2)
    
    return datos


def completar_datos_propiedades():
    """Completa datos faltantes en propiedades existentes."""
    
    print("\n" + "="*60)
    print("SCRIPT 05: Completar datos faltantes en propiedades")
    print("="*60)
    
    with Session(engine) as session:
        # Obtener todas las propiedades activas
        statement = select(Propiedad).where(Propiedad.deleted_at.is_(None))
        propiedades = session.exec(statement).all()
        
        print(f"\nPropiedades encontradas: {len(propiedades)}")
        
        if len(propiedades) == 0:
            print("No hay propiedades en la base de datos.")
            return
        
        # Contadores
        actualizadas = 0
        sin_cambios = 0
        campos_completados = {
            'ambientes': 0,
            'metros_cuadrados': 0,
            'valor_alquiler': 0,
            'expensas': 0,
            'fecha_ingreso': 0
        }
        
        for propiedad in propiedades:
            tiene_cambios = False
            datos_actualizar = {}
            
            # Generar datos según tipo si hay campos faltantes
            datos_tipo = generar_datos_por_tipo(propiedad.tipo)
            
            # Verificar y completar cada campo
            if propiedad.ambientes is None and datos_tipo['ambientes'] is not None:
                datos_actualizar['ambientes'] = datos_tipo['ambientes']
                campos_completados['ambientes'] += 1
                tiene_cambios = True
            
            if propiedad.metros_cuadrados is None:
                datos_actualizar['metros_cuadrados'] = datos_tipo['metros_cuadrados']
                campos_completados['metros_cuadrados'] += 1
                tiene_cambios = True
            
            if propiedad.valor_alquiler is None:
                datos_actualizar['valor_alquiler'] = datos_tipo['valor_alquiler']
                campos_completados['valor_alquiler'] += 1
                tiene_cambios = True
            
            if propiedad.expensas is None and datos_tipo['expensas'] is not None:
                datos_actualizar['expensas'] = datos_tipo['expensas']
                campos_completados['expensas'] += 1
                tiene_cambios = True
            
            if propiedad.fecha_ingreso is None:
                # Fecha de ingreso entre 1 mes y 2 años atrás
                fecha_ingreso = datetime.utcnow() - timedelta(days=randint(30, 730))
                datos_actualizar['fecha_ingreso'] = fecha_ingreso.date()
                campos_completados['fecha_ingreso'] += 1
                tiene_cambios = True
            
            # Aplicar cambios
            if tiene_cambios:
                for campo, valor in datos_actualizar.items():
                    setattr(propiedad, campo, valor)
                
                actualizadas += 1
                
                # Mostrar cambios
                campos_texto = ', '.join(datos_actualizar.keys())
                print(f"  Propiedad ID {propiedad.id} ({propiedad.nombre}): completados {campos_texto}")
            else:
                sin_cambios += 1
        
        # Guardar cambios
        session.commit()
        
        # Resumen
        print("\n" + "-"*60)
        print("RESUMEN:")
        print(f"  Total propiedades: {len(propiedades)}")
        print(f"  Actualizadas: {actualizadas}")
        print(f"  Sin cambios (ya completas): {sin_cambios}")
        
        if sum(campos_completados.values()) > 0:
            print(f"\nCampos completados:")
            for campo, count in campos_completados.items():
                if count > 0:
                    print(f"  - {campo}: {count}")
        
        print("-"*60)
        print("Completado exitosamente\n")


if __name__ == "__main__":
    try:
        # Verificar si se pasó --confirm como argumento
        auto_confirm = '--confirm' in sys.argv or '-y' in sys.argv
        
        if not auto_confirm:
            print("\n" + "="*60)
            print("CONFIRMACION")
            print("="*60)
            print("\nEste script completara datos faltantes en propiedades.")
            print("Los valores se generaran de forma aleatoria pero realista.")
            print("\nDesea continuar? (escriba 'SI' para confirmar)")
            print("O ejecute con: python script.py --confirm")
            
            confirmacion = input("\n> ").strip().upper()
            
            if confirmacion != 'SI':
                print("\nOperacion cancelada por el usuario\n")
                sys.exit(0)
        
        completar_datos_propiedades()
            
    except Exception as e:
        print(f"\nError durante la actualizacion: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
