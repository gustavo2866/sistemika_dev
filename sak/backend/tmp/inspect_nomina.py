from app.db import engine
from sqlalchemy import text

with engine.connect() as conn:
    proyectos = conn.execute(
        text("SELECT id, nombre FROM proyectos WHERE estado = 'ejecucion' ORDER BY id")
    ).fetchall()
    print(f"Proyectos en ejecucion: {len(proyectos)}")
    for p in proyectos:
        print(f"  id={p[0]}: {str(p[1])[:60]}")

    total = conn.execute(text("SELECT COUNT(*) FROM nominas")).scalar()
    print(f"\nEmpleados actuales: {total}")

    cats = conn.execute(text("SELECT DISTINCT categoria FROM nominas")).fetchall()
    print("Categorias existentes:", [c[0] for c in cats])
