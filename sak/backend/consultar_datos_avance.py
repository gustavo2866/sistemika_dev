#!/usr/bin/env python3

from sqlmodel import select
from app.db import get_session
from app.models.proy_presupuesto import ProyPresupuesto
from app.models.proyecto import Proyecto

def main():
    with next(get_session()) as db:
        # Obtener presupuestos para proyectos 14-17
        presupuestos = db.exec(select(ProyPresupuesto).where(ProyPresupuesto.proyecto_id.in_([14, 15, 16, 17]))).all()
        
        # Obtener info básica de los proyectos
        proyectos = db.exec(select(Proyecto).where(Proyecto.id.in_([14, 15, 16, 17]))).all()
        
        print('=== PROYECTOS ===')
        for p in proyectos:
            print(f'Proyecto {p.id}: {p.nombre} - Superficie: {p.superficie}%')
        
        print('\n=== PRESUPUESTOS ===')
        for pres in presupuestos:
            total = pres.mo_propia + pres.mo_terceros + pres.materiales
            print(f'Proyecto {pres.proyecto_id} - {pres.fecha}: Total=${total:,.2f} (MOPropia: ${pres.mo_propia:,.2f}, MOTerceros: ${pres.mo_terceros:,.2f}, Materiales: ${pres.materiales:,.2f})')

if __name__ == "__main__":
    main()