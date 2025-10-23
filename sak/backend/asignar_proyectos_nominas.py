"""Script para asignar proyectos a nóminas que no tienen uno asignado."""

import os

from sqlmodel import Session, create_engine, select

from app.models import Nomina, Proyecto


def asignar_proyectos():
    """Asigna proyectos a las nóminas que no tienen uno."""
    
    # Usar DATABASE_URL de variable de entorno
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ Error: DATABASE_URL no está configurado")
        return
    
    print(f"📊 Conectando a la base de datos de producción...")
    engine = create_engine(database_url, echo=False)
    
    with Session(engine) as session:
        # Obtener proyectos disponibles
        proyectos = session.exec(select(Proyecto)).all()
        
        if not proyectos:
            print("❌ No hay proyectos disponibles en la base de datos")
            return
        
        print(f"📊 Proyectos disponibles: {len(proyectos)}")
        for proyecto in proyectos:
            print(f"   - ID: {proyecto.id}, Nombre: {proyecto.nombre}")
        
        # Obtener nóminas sin proyecto asignado
        nominas_sin_proyecto = session.exec(
            select(Nomina).where(Nomina.idproyecto == None)
        ).all()
        
        print(f"\n📊 Nóminas sin proyecto: {len(nominas_sin_proyecto)}")
        
        if not nominas_sin_proyecto:
            print("✅ Todas las nóminas ya tienen un proyecto asignado")
            return
        
        # Asignar el primer proyecto disponible a todas las nóminas sin proyecto
        proyecto_default = proyectos[0]
        
        updated = 0
        for nomina in nominas_sin_proyecto:
            nomina.idproyecto = proyecto_default.id
            session.add(nomina)
            updated += 1
            print(f"✅ Asignado proyecto '{proyecto_default.nombre}' a: {nomina.nombre} {nomina.apellido}")
        
        session.commit()
        
        # Verificar resultados
        nominas_actualizadas = session.exec(select(Nomina)).all()
        sin_proyecto = sum(1 for n in nominas_actualizadas if n.idproyecto is None)
        
        print(f"\n🎉 Proceso completado!")
        print(f"📊 Nóminas actualizadas: {updated}")
        print(f"📊 Total de nóminas: {len(nominas_actualizadas)}")
        print(f"📊 Nóminas sin proyecto: {sin_proyecto}")


if __name__ == "__main__":
    asignar_proyectos()
