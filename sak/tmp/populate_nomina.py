import csv, os, random
from datetime import date, timedelta
from pathlib import Path
import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")
DB_URL = os.getenv("DATABASE_URL", "").replace("postgresql+psycopg://", "postgresql://")
CSV_PATH = Path(__file__).parent.parent / "backend" / "data" / "nomina.csv"

CATEGORIAS = ["oficial", "medio_oficial", "ayudante", "administrativo"]
CALLES = ["San Martin", "Belgrano", "Rivadavia", "Mitre", "Sarmiento", "Las Heras", "9 de Julio"]
PROVINCIAS = ["Tucuman", "Cordoba", "Salta", "Mendoza", "Buenos Aires"]


def split_ap_nom(raw):
    raw = raw.strip()
    if "," in raw:
        p = raw.split(",", 1)
        return p[0].strip().title(), p[1].strip().title()
    w = raw.split()
    return w[0].title(), " ".join(w[1:]).title() if len(w) > 1 else ""


def rdate(y1, y2):
    s = date(y1, 1, 1)
    e = date(y2, 12, 31)
    return s + timedelta(days=random.randint(0, (e - s).days))


rows = []
with open(CSV_PATH, encoding="latin-1") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
        legajo = row["Legajo"].strip()
        ap, nom = split_ap_nom(row["Apellido y Nombre"])
        id_obra = row["ID_OBRA"].strip()
        dni = legajo[:8].ljust(8, "0")
        nom_clean = nom.lower().replace(" ", ".")
        ap_clean = ap.lower().replace(" ", ".")
        email = f"{nom_clean}.{ap_clean}@empleados.com"[:255]
        tel = f"0381-{random.randint(4000000, 4999999)}"
        dir_ = f"{random.choice(CALLES)} {random.randint(100, 9999)}, {random.choice(PROVINCIAS)}"
        fec_nac = rdate(1965, 2000)
        fec_ing = rdate(2010, 2024)
        salario = round(random.uniform(250000, 600000), 2)
        cat = random.choice(CATEGORIAS)
        idobra = int(id_obra) if id_obra.isdigit() else None
        rows.append((nom, ap, dni, email, tel, dir_, fec_nac, fec_ing, salario, cat, idobra, legajo))

print(f"Registros a insertar: {len(rows)}")
ins = 0
skip = 0
with psycopg.connect(DB_URL) as conn:
    with conn.cursor() as cur:
        for r in rows:
            cur.execute(
                """
                INSERT INTO nominas(nombre,apellido,dni,email,telefono,direccion,
                  fecha_nacimiento,fecha_ingreso,fecha_egreso,salario_mensual,
                  categoria,idproyecto,nro_legajo,activo,version,created_at,updated_at)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,NULL,%s,%s,%s,%s,TRUE,1,NOW(),NOW())
                ON CONFLICT(dni) DO NOTHING
                """,
                r,
            )
            if cur.rowcount:
                ins += 1
            else:
                skip += 1
        conn.commit()

print(f"Insertados: {ins} | Omitidos: {skip}")
