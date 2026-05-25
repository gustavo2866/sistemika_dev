import sys
sys.path.insert(0, ".")
from app.db import engine
from sqlalchemy import text

with engine.connect() as conn:
    cols = conn.execute(
        text(
            "SELECT column_name, is_nullable, column_default "
            "FROM information_schema.columns "
            "WHERE table_name='nominas' ORDER BY ordinal_position"
        )
    ).fetchall()
    print("Columnas de nominas:")
    for c in cols:
        print(f"  {c[0]}: nullable={c[1]}, default={c[2]}")
