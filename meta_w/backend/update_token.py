"""
Script para actualizar el token de acceso de Meta de una empresa.
Uso: python update_token.py <empresa_id> <nuevo_token>
"""
import sys
from app.db.session import engine
from sqlalchemy import text

if len(sys.argv) != 3:
    print("Uso: python update_token.py <empresa_id> <nuevo_token>")
    print("\nEjemplo:")
    print("python update_token.py 692d787d-06c4-432e-a94e-cf0686e593eb EAAxxxxx...")
    sys.exit(1)

empresa_id = sys.argv[1]
nuevo_token = sys.argv[2]

with engine.connect() as conn:
    # Verificar que la empresa existe
    result = conn.execute(
        text("SELECT nombre FROM empresas WHERE id = :id"),
        {"id": empresa_id}
    )
    row = result.fetchone()
    
    if not row:
        print(f"❌ No se encontró empresa con ID: {empresa_id}")
        sys.exit(1)
    
    print(f"✓ Empresa encontrada: {row[0]}")
    
    # Actualizar token
    conn.execute(
        text("UPDATE empresas SET meta_access_token = :token WHERE id = :id"),
        {"token": nuevo_token, "id": empresa_id}
    )
    conn.commit()
    
    print(f"✓ Token actualizado exitosamente")
    print(f"  Longitud: {len(nuevo_token)} caracteres")
    print(f"  Primeros 20 chars: {nuevo_token[:20]}...")
