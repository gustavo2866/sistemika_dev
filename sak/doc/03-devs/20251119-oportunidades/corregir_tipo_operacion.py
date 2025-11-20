"""
Script para corregir inconsistencias de tipo_operacion_id en propiedades con emprendimiento
"""
import sys
import os
import io

# Configurar encoding UTF-8 para Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

from sqlmodel import Session, select
from app.db import engine
from app.models import Propiedad

def corregir_tipo_operacion_emprendimientos():
    """Corregir propiedades con emprendimiento_id para que tengan tipo_operacion_id = 3"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("CORRECCIÓN DE TIPO DE OPERACIÓN EN PROPIEDADES DE EMPRENDIMIENTOS")
    print("="*80 + "\n")
    
    # Buscar propiedades con emprendimiento pero tipo_operacion != 3
    propiedades_incorrectas = session.exec(
        select(Propiedad).where(
            Propiedad.emprendimiento_id.isnot(None),
            Propiedad.tipo_operacion_id != 3
        )
    ).all()
    
    print(f"Propiedades encontradas con tipo_operacion incorrecto: {len(propiedades_incorrectas)}\n")
    
    if len(propiedades_incorrectas) == 0:
        print("✅ No hay inconsistencias para corregir")
        session.close()
        return
    
    corregidas = 0
    for prop in propiedades_incorrectas:
        tipo_anterior = prop.tipo_operacion_id
        prop.tipo_operacion_id = 3  # Emprendimiento
        session.add(prop)
        corregidas += 1
        
        if corregidas <= 10:  # Mostrar solo las primeras 10
            print(f"✅ Propiedad {prop.id} '{prop.nombre}': {tipo_anterior} → 3 (Emprendimiento)")
    
    if corregidas > 10:
        print(f"   ... y {corregidas - 10} más")
    
    session.commit()
    print(f"\n✅ {corregidas} propiedades corregidas")
    
    # Verificar resultado
    print("\n" + "="*80)
    print("VERIFICACIÓN POST-CORRECCIÓN")
    print("="*80 + "\n")
    
    # Contar propiedades con emprendimiento por tipo
    props_con_emp = session.exec(
        select(Propiedad).where(Propiedad.emprendimiento_id.isnot(None))
    ).all()
    
    por_tipo = {}
    for prop in props_con_emp:
        tipo = prop.tipo_operacion_id or 'null'
        por_tipo[tipo] = por_tipo.get(tipo, 0) + 1
    
    print(f"Propiedades con emprendimiento_id por tipo de operación:")
    for tipo, count in sorted(por_tipo.items()):
        tipo_nombre = {1: "Alquiler", 2: "Venta", 3: "Emprendimiento", 'null': "Sin tipo"}.get(tipo, str(tipo))
        icono = "✅" if tipo == 3 else "❌"
        print(f"   {icono} {tipo_nombre}: {count}")
    
    # Verificar que no queden inconsistencias
    inconsistentes = session.exec(
        select(Propiedad).where(
            Propiedad.emprendimiento_id.isnot(None),
            Propiedad.tipo_operacion_id != 3
        )
    ).all()
    
    if len(inconsistentes) == 0:
        print(f"\n✅ TODAS LAS PROPIEDADES CON EMPRENDIMIENTO TIENEN TIPO_OPERACION_ID = 3")
    else:
        print(f"\n⚠️  Aún quedan {len(inconsistentes)} propiedades inconsistentes")
    
    session.close()

if __name__ == "__main__":
    try:
        corregir_tipo_operacion_emprendimientos()
        print("\n✅ CORRECCIÓN COMPLETADA\n")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
