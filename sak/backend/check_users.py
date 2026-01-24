#!/usr/bin/env python3
"""
Ver usuarios disponibles para login
"""

import os
from dotenv import load_dotenv
from sqlmodel import create_engine, text

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

print("👥 Usuarios disponibles para login:\n")

try:
    engine = create_engine(
        DATABASE_URL,
        pool_timeout=30,
        connect_args={"connect_timeout": 30}
    )
    
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, nombre, email 
            FROM users 
            ORDER BY id 
            LIMIT 10
        """))
        
        users = result.fetchall()
        
        for user in users:
            print(f"🆔 ID: {user[0]}")
            print(f"📝 Nombre: {user[1]}")
            print(f"📧 Email: {user[2]}")
            print("---")
        
        print(f"\n✅ Total: {len(users)} usuarios encontrados")
        print("\n🔑 Para hacer login usa:")
        if users:
            print(f"   Username: {users[0][2]} (email)")
            print(f"   Password: cualquier_cosa (modo desarrollo)")
    
except Exception as e:
    print(f"❌ Error: {e}")