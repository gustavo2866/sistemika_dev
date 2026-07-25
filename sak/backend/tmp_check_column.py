from app.db import engine
import sqlalchemy as sa

conn = engine.connect()
try:
    result = conn.execute(sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='erp_cuentas' AND column_name='proyectos_concepto_id'"))
    cols = [row[0] for row in result]
    print('COLUMN_PRESENT=', bool(cols))
    print('COLUMNS=', cols)
finally:
    conn.close()
