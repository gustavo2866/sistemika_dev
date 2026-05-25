"""
Puebla la tabla nominas con 140 registros distribuidos entre
los proyectos en estado '02-ejecucion'.
"""
import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

sys.path.insert(0, ".")

from app.db import engine
from sqlalchemy import text

# ---------------------------------------------------------------------------
# Datos de referencia
# ---------------------------------------------------------------------------
NOMBRES = [
    "Agustín", "Bruno", "Carlos", "Diego", "Eduardo", "Fabio", "Gonzalo",
    "Hernán", "Ignacio", "Javier", "Kevin", "Luciano", "Matías", "Nicolás",
    "Oscar", "Pablo", "Ramiro", "Sergio", "Tomás", "Ulises", "Valentín",
    "Walter", "Xavier", "Yamil", "Ezequiel", "Rodrigo", "Leandro", "Marcelo",
    "Alejandro", "Fernando", "Gustavo", "Horacio", "Iván", "Jorge", "Karina",
    "Laura", "Marina", "Natalia", "Paula", "Romina", "Silvina", "Teresa",
    "Vanesa", "Yamila", "Zulma", "Claudia", "Diana", "Elena", "Florencia",
    "Gabriela", "Beatriz", "Ana", "Cecilia", "Daniela", "Adriana", "Lorena",
]

APELLIDOS = [
    "García", "Fernández", "Rodríguez", "López", "Martínez", "González",
    "Pérez", "Sánchez", "Romero", "Torres", "Flores", "Díaz", "Morales",
    "Álvarez", "Vega", "Castro", "Ortiz", "Ruiz", "Herrera", "Medina",
    "Reyes", "Aguilar", "Mendoza", "Ramos", "Silva", "Gutiérrez", "Vargas",
    "Jiménez", "Suárez", "Molina", "Muñoz", "Cabrera", "Acosta", "Ríos",
    "Navarro", "Guerrero", "Paredes", "Benítez", "Salinas", "Miranda",
    "Delgado", "Peralta", "Bravo", "Palacios", "Ibáñez", "Escobar",
    "Cárdenas", "Fuentes", "Núñez", "Vera", "Luna", "Montes", "Pacheco",
    "Carrasco", "Bustos", "Espinoza", "Figueroa", "Heredia", "Ponce",
]

CATEGORIAS = ["oficial", "medio_oficial", "ayudante", "administrativo"]

# Salarios base por categoría
SALARIOS = {
    "oficial":        (180_000, 260_000),
    "medio_oficial":  (130_000, 180_000),
    "ayudante":       (90_000,  130_000),
    "administrativo": (150_000, 220_000),
}

CALLES = [
    "Corrientes", "Rivadavia", "San Martín", "Belgrano", "Mitre",
    "Sarmiento", "Avellaneda", "Roca", "Libertad", "Colón",
]


def random_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def main() -> None:
    with engine.connect() as conn:
        # Obtener proyectos en ejecución
        proyectos = conn.execute(
            text("SELECT id FROM proyectos WHERE estado = '02-ejecucion' ORDER BY id")
        ).fetchall()
        proyecto_ids = [p[0] for p in proyectos]

        if not proyecto_ids:
            print("No hay proyectos en estado '02-ejecucion'. Abortando.")
            return

        print(f"Proyectos en ejecucion encontrados: {proyecto_ids}")

        # DNIs ya usados para no repetir
        existentes = conn.execute(text("SELECT dni FROM nominas")).fetchall()
        dnis_usados: set = {r[0] for r in existentes}

        emails_usados: set = set()
        erows = conn.execute(text("SELECT email FROM nominas WHERE email IS NOT NULL")).fetchall()
        emails_usados = {r[0] for r in erows}

        registros = []
        intentos = 0
        while len(registros) < 140 and intentos < 5000:
            intentos += 1
            nombre = random.choice(NOMBRES)
            apellido = random.choice(APELLIDOS)

            # DNI de 8 dígitos aleatorio
            dni = str(random.randint(10_000_000, 45_000_000))
            if dni in dnis_usados:
                continue
            dnis_usados.add(dni)

            # Email con sufijo numérico para evitar colisiones
            email_base = f"{nombre.lower().replace(' ', '').replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u').replace('ñ','n')}.{apellido.lower().replace(' ', '').replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u').replace('ñ','n')}"
            suffix = random.randint(1, 9999)
            email = f"{email_base}{suffix}@empresa.com"
            while email in emails_usados:
                suffix += 1
                email = f"{email_base}{suffix}@empresa.com"
            emails_usados.add(email)

            telefono = f"11{random.randint(10_000_000, 99_999_999)}"
            direccion = f"{random.choice(CALLES)} {random.randint(100, 9999)}"
            fnac = random_date(date(1970, 1, 1), date(2000, 12, 31))
            fingreso = random_date(date(2018, 1, 1), date(2026, 1, 1))
            categoria = random.choice(CATEGORIAS)
            sal_min, sal_max = SALARIOS[categoria]
            salario = Decimal(str(random.randint(sal_min, sal_max)))

            # Distribuir entre proyectos en ejecución
            idproyecto = random.choice(proyecto_ids)
            now = datetime.now(timezone.utc)

            registros.append({
                "nombre": nombre,
                "apellido": apellido,
                "dni": dni,
                "email": email,
                "telefono": telefono,
                "direccion": direccion,
                "fecha_nacimiento": fnac,
                "fecha_ingreso": fingreso,
                "salario_mensual": salario,
                "categoria": categoria,
                "idproyecto": idproyecto,
                "activo": True,
                "version": 1,
                "created_at": now,
                "updated_at": now,
            })

        print(f"Registros generados: {len(registros)}")

        conn.execute(
            text("""
                INSERT INTO nominas
                    (nombre, apellido, dni, email, telefono, direccion,
                     fecha_nacimiento, fecha_ingreso, salario_mensual,
                     categoria, idproyecto, activo, version, created_at, updated_at)
                VALUES
                    (:nombre, :apellido, :dni, :email, :telefono, :direccion,
                     :fecha_nacimiento, :fecha_ingreso, :salario_mensual,
                     :categoria, :idproyecto, :activo, :version, :created_at, :updated_at)
            """),
            registros,
        )
        conn.commit()

        total = conn.execute(text("SELECT COUNT(*) FROM nominas")).scalar()
        print(f"Total de nominas en la tabla: {total}")

        # Resumen por proyecto
        resumen = conn.execute(
            text("""
                SELECT p.nombre, COUNT(n.id) as empleados
                FROM proyectos p
                LEFT JOIN nominas n ON n.idproyecto = p.id
                WHERE p.estado = '02-ejecucion'
                GROUP BY p.nombre
                ORDER BY empleados DESC
            """)
        ).fetchall()
        print("\nEmpleados por proyecto en ejecucion:")
        for r in resumen:
            print(f"  {str(r[0])[:50]}: {r[1]} empleados")


if __name__ == "__main__":
    main()
