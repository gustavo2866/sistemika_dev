"""Verificacion post-fix: resumen de vacancia_fecha por estado."""
from app.db import get_session
from app.models.propiedad import Propiedad, PropiedadesStatus
from sqlmodel import select
from collections import defaultdict

with next(get_session()) as s:
    rows = s.exec(
        select(Propiedad, PropiedadesStatus)
        .where(Propiedad.deleted_at.is_(None))
        .join(PropiedadesStatus, Propiedad.propiedad_status_id == PropiedadesStatus.id, isouter=True)
    ).all()

    resumen = defaultdict(lambda: {"con_fecha": 0, "sin_fecha": 0})
    for p, st in rows:
        nombre = st.nombre if st else "SIN_ESTADO"
        key = "con_fecha" if p.vacancia_fecha else "sin_fecha"
        resumen[nombre][key] += 1

    print("Estado final de vacancia_fecha por estado:")
    total_sin = 0
    for st_nombre in sorted(resumen.keys()):
        c = resumen[st_nombre]
        total_sin += c["sin_fecha"]
        print(f"  {st_nombre:<20}  con_fecha={c['con_fecha']:3d}  sin_fecha={c['sin_fecha']:3d}")

    print()
    if total_sin == 0:
        print("[OK] Todas las propiedades tienen vacancia_fecha.")
    else:
        print(f"[ADVERTENCIA] {total_sin} propiedad(es) todavia sin vacancia_fecha.")
