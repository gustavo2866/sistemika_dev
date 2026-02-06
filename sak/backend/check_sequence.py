from app.db import get_session
from sqlalchemy import text

def check_sequence():
    session = next(get_session())
    
    # Verificar próximo valor de la secuencia (sin avanzar)
    result = session.execute(text("SELECT last_value, is_called FROM po_solicitud_detalles_id_seq"))
    last_value, is_called = result.fetchone()
    print(f"Último valor secuencia: {last_value}, is_called: {is_called}")
    
    # Verificar el próximo valor que dará la secuencia  
    result = session.execute(text("SELECT nextval('po_solicitud_detalles_id_seq')"))
    next_val = result.fetchone()[0]
    print(f"Próximo valor secuencia: {next_val}")
    
    # Verificar registros problemáticos
    result = session.execute(text("SELECT id, solicitud_id FROM po_solicitud_detalles WHERE id <= 1 ORDER BY id"))
    records = result.fetchall()
    print(f"Registros con ID <= 1:")
    for record in records:
        print(f"  ID: {record[0]}, solicitud_id: {record[1]}")

if __name__ == "__main__":
    check_sequence()