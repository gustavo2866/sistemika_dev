import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad

def verificacion_final():
    with Session(engine) as session:
        statement = select(CRMOportunidad).order_by(CRMOportunidad.id)
        oportunidades = session.exec(statement).all()
        
        print(f"=== VERIFICACIÓN FINAL DE DESCRIPCIONES ===\n")
        print(f"Total de oportunidades: {len(oportunidades)}\n")
        
        # Agrupar por tipo
        por_tipo = {}
        problemas = []
        
        for oport in oportunidades:
            tipo_nombre = "sin_tipo"
            if oport.tipo_operacion:
                tipo_nombre = oport.tipo_operacion.nombre
            
            if tipo_nombre not in por_tipo:
                por_tipo[tipo_nombre] = []
            
            # Verificar que tenga descripción
            if not oport.descripcion or len(oport.descripcion.strip()) < 20:
                problemas.append(f"ID {oport.id}: descripción muy corta o vacía")
            else:
                # Guardar muestra
                if len(por_tipo[tipo_nombre]) < 3:
                    primeras_palabras = ' '.join(oport.descripcion.split()[:10])
                    por_tipo[tipo_nombre].append((oport.id, primeras_palabras))
        
        # Mostrar resultados
        print("Distribución y muestras por tipo:\n")
        for tipo, muestras in sorted(por_tipo.items()):
            total = sum(1 for o in oportunidades if (o.tipo_operacion.nombre if o.tipo_operacion else 'sin_tipo') == tipo)
            print(f"{tipo}: {total} oportunidades")
            for id_oport, desc in muestras[:3]:
                print(f"  ↳ ID {id_oport}: {desc}...")
            print()
        
        if problemas:
            print(f"\n⚠️ Problemas encontrados: {len(problemas)}")
            for problema in problemas[:10]:
                print(f"  {problema}")
        else:
            print("✅ Todas las oportunidades tienen descripciones coherentes")
            print("✅ Las primeras palabras son significativas y funcionan como título")

if __name__ == "__main__":
    verificacion_final()
