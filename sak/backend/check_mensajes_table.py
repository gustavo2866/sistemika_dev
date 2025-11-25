from sqlalchemy import create_engine, text

engine = create_engine('postgresql+psycopg://sak_user:cambia_esta_clave@localhost:5432/sak')
conn = engine.connect()

# Verificar si existe la tabla
result = conn.execute(text("""
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'crm_mensajes'
    )
"""))
existe = result.fetchone()[0]
print(f"\n¿Tabla crm_mensajes existe? {existe}")

if existe:
    # Listar columnas
    result = conn.execute(text("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'crm_mensajes' 
        ORDER BY ordinal_position
    """))
    
    print("\nColumnas de crm_mensajes:")
    for row in result:
        print(f"  - {row[0]:<30} {row[1]:<20} (nullable: {row[2]})")
    
    # Verificar si existe fecha_mensaje
    result = conn.execute(text("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'crm_mensajes' AND column_name = 'fecha_mensaje'
        )
    """))
    tiene_fecha = result.fetchone()[0]
    print(f"\n¿Tiene campo fecha_mensaje? {tiene_fecha}")

conn.close()
