"""
Script para poblar el campo titulo de las oportunidades existentes.
Genera un título basado en la descripcion_estado o información disponible.
"""
from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad

def generar_titulo(oportunidad: CRMOportunidad) -> str:
    """Genera un título para la oportunidad basado en sus datos."""
    # Si ya tiene titulo, no modificar
    if oportunidad.titulo:
        return oportunidad.titulo
    
    # Opción 1: Usar descripcion_estado truncada
    if oportunidad.descripcion_estado:
        desc = oportunidad.descripcion_estado.strip()
        if len(desc) <= 100:
            return desc
        # Truncar a 100 caracteres en un espacio
        truncated = desc[:97]
        last_space = truncated.rfind(' ')
        if last_space > 50:  # Si hay un espacio razonable
            return truncated[:last_space] + "..."
        return truncated + "..."
    
    # Opción 2: Título genérico con ID
    return f"Oportunidad #{oportunidad.id}"

def main():
    with Session(engine) as session:
        # Obtener todas las oportunidades sin título
        statement = select(CRMOportunidad).where(
            (CRMOportunidad.titulo == None) | (CRMOportunidad.titulo == "")
        )
        oportunidades = session.exec(statement).all()
        
        print(f"Encontradas {len(oportunidades)} oportunidades sin título")
        
        if not oportunidades:
            print("✅ Todas las oportunidades ya tienen título")
            return
        
        # Actualizar cada oportunidad
        updated = 0
        for oportunidad in oportunidades:
            titulo = generar_titulo(oportunidad)
            oportunidad.titulo = titulo
            updated += 1
            
            if updated % 100 == 0:
                print(f"Procesadas {updated} oportunidades...")
        
        # Guardar cambios
        session.commit()
        print(f"\n✅ Se actualizaron {updated} oportunidades con título")
        
        # Mostrar algunos ejemplos
        print("\nEjemplos de títulos generados:")
        for i, oportunidad in enumerate(oportunidades[:5], 1):
            print(f"  {i}. ID {oportunidad.id}: {oportunidad.titulo}")

if __name__ == "__main__":
    main()
