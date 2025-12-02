"""
Script para probar el endpoint de buscar-actividades directamente
"""
from sqlmodel import Session
from app.db import engine
from app.routers.crm_mensaje_router import obtener_actividades

with Session(engine) as session:
    try:
        result = obtener_actividades(
            session=session,
            mensaje_id=None,
            contacto_id=None,
            oportunidad_id=6521
        )
        print("\n✅ Resultado exitoso:")
        print(f"Total actividades: {result.get('total', 0)}")
        print(f"Criterio: {result.get('criterio')}")
        
        if result.get('actividades'):
            print("\nPrimeras 3 actividades:")
            for act in result['actividades'][:3]:
                print(f"  - Tipo: {act.get('tipo')} | Fecha: {act.get('fecha')} | Titulo/Desc: {act.get('titulo') or act.get('descripcion')}")
    except Exception as e:
        print("\n❌ Error al ejecutar:")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
