"""Script para agregar 10 registros de nóminas a la base de datos de producción."""

import os
from datetime import date
from decimal import Decimal

from sqlmodel import Session, create_engine, select

from app.models import Nomina


def seed_nominas():
    """Agrega 10 registros de nóminas a la base de datos de producción."""
    
    # Usar DATABASE_URL de variable de entorno
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ Error: DATABASE_URL no está configurado")
        return
    
    print(f"📊 Conectando a la base de datos de producción...")
    engine = create_engine(database_url, echo=False)
    
    with Session(engine) as session:
        # Datos de nóminas de ejemplo
        nominas_data = [
            {
                "nombre": "Juan",
                "apellido": "Pérez",
                "dni": "12345678",
                "email": "juan.perez@sistemika.com",
                "telefono": "+54 11 1234-5678",
                "categoria": "oficial",
                "salario_mensual": Decimal("150000.00"),
                "fecha_ingreso": date(2023, 1, 15),
                "activo": True
            },
            {
                "nombre": "María",
                "apellido": "González",
                "dni": "23456789",
                "email": "maria.gonzalez@sistemika.com",
                "telefono": "+54 11 2345-6789",
                "categoria": "medio_oficial",
                "salario_mensual": Decimal("120000.00"),
                "fecha_ingreso": date(2023, 2, 1),
                "activo": True
            },
            {
                "nombre": "Carlos",
                "apellido": "Rodríguez",
                "dni": "34567890",
                "email": "carlos.rodriguez@sistemika.com",
                "telefono": "+54 11 3456-7890",
                "categoria": "oficial",
                "salario_mensual": Decimal("155000.00"),
                "fecha_ingreso": date(2023, 3, 10),
                "activo": True
            },
            {
                "nombre": "Ana",
                "apellido": "Martínez",
                "dni": "45678901",
                "email": "ana.martinez@sistemika.com",
                "telefono": "+54 11 4567-8901",
                "categoria": "ayudante",
                "salario_mensual": Decimal("100000.00"),
                "fecha_ingreso": date(2023, 4, 5),
                "activo": True
            },
            {
                "nombre": "Roberto",
                "apellido": "López",
                "dni": "56789012",
                "email": "roberto.lopez@sistemika.com",
                "telefono": "+54 11 5678-9012",
                "categoria": "oficial",
                "salario_mensual": Decimal("160000.00"),
                "fecha_ingreso": date(2023, 5, 20),
                "activo": True
            },
            {
                "nombre": "Laura",
                "apellido": "Fernández",
                "dni": "67890123",
                "email": "laura.fernandez@sistemika.com",
                "telefono": "+54 11 6789-0123",
                "categoria": "medio_oficial",
                "salario_mensual": Decimal("125000.00"),
                "fecha_ingreso": date(2023, 6, 15),
                "activo": True
            },
            {
                "nombre": "Diego",
                "apellido": "García",
                "dni": "78901234",
                "email": "diego.garcia@sistemika.com",
                "telefono": "+54 11 7890-1234",
                "categoria": "oficial",
                "salario_mensual": Decimal("158000.00"),
                "fecha_ingreso": date(2023, 7, 1),
                "activo": True
            },
            {
                "nombre": "Silvia",
                "apellido": "Romero",
                "dni": "89012345",
                "email": "silvia.romero@sistemika.com",
                "telefono": "+54 11 8901-2345",
                "categoria": "ayudante",
                "salario_mensual": Decimal("105000.00"),
                "fecha_ingreso": date(2023, 8, 10),
                "activo": True
            },
            {
                "nombre": "Fernando",
                "apellido": "Sánchez",
                "dni": "90123456",
                "email": "fernando.sanchez@sistemika.com",
                "telefono": "+54 11 9012-3456",
                "categoria": "oficial",
                "salario_mensual": Decimal("162000.00"),
                "fecha_ingreso": date(2023, 9, 5),
                "activo": True
            },
            {
                "nombre": "Patricia",
                "apellido": "Torres",
                "dni": "01234567",
                "email": "patricia.torres@sistemika.com",
                "telefono": "+54 11 0123-4567",
                "categoria": "medio_oficial",
                "salario_mensual": Decimal("128000.00"),
                "fecha_ingreso": date(2023, 10, 1),
                "activo": True
            }
        ]
        
        # Verificar cuántas nóminas ya existen
        existing_count = session.exec(select(Nomina)).all()
        print(f"📊 Nóminas existentes: {len(existing_count)}")
        
        # Crear nóminas
        created = 0
        for data in nominas_data:
            # Verificar si ya existe una nómina con este DNI
            existing = session.exec(
                select(Nomina).where(Nomina.dni == data["dni"])
            ).first()
            
            if existing:
                print(f"⏭️  Nómina con DNI {data['dni']} ya existe")
                continue
            
            nomina = Nomina(**data)
            session.add(nomina)
            created += 1
            print(f"✅ Creada nómina: {data['nombre']} {data['apellido']}")
        
        session.commit()
        
        # Verificar total
        total = len(session.exec(select(Nomina)).all())
        print(f"\n🎉 Proceso completado!")
        print(f"📊 Nóminas creadas: {created}")
        print(f"📊 Total de nóminas en la base de datos: {total}")


if __name__ == "__main__":
    seed_nominas()
