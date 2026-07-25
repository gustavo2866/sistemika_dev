from app.db import DATABASE_URL, engine
import sqlalchemy as sa

print('DATABASE_URL=', DATABASE_URL)
with engine.connect() as conn:
    print('TABLE_EXISTS=', conn.execute(sa.text("SELECT to_regclass('public.erp_cuentas')")).scalar())
    print('TABLES=', [r[0] for r in conn.execute(sa.text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'erp%' ORDER BY tablename"))])
    print('COLUMNS=', [r[0] for r in conn.execute(sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='erp_cuentas' ORDER BY ordinal_position"))])
