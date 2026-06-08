from app.db import engine
from sqlmodel import Session, select
from app.models import CRMMensaje

with Session(engine) as s:
    rows = s.exec(
        select(CRMMensaje)
        .order_by(CRMMensaje.id.desc())
        .limit(5)
    ).all()
    for m in rows:
        meta = m.metadata_json or {}
        print(f"id={m.id} tipo={m.tipo} estado={m.estado} estado_meta={m.estado_meta}")
        print(f"  fecha={m.fecha_mensaje} origen_externo_id={m.origen_externo_id}")
        print(f"  contacto_id={m.contacto_id} oportunidad_id={m.oportunidad_id} canal={m.canal}")
        if meta.get("error"):
            print(f"  ERROR: {meta['error']}")
        if meta.get("agent_v2"):
            av2 = meta["agent_v2"]
            print(f"  agent_v2: processed={av2.get('processed')} delivery={av2.get('delivery')} timing={av2.get('timing')}")
        print()
