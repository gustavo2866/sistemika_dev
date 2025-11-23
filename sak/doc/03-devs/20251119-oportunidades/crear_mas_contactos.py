"""
Crear más contactos para distribuir mejor las oportunidades
"""
import sys
import os
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../backend')))

from sqlmodel import Session, select
from app.db import engine
from app.models import CRMContacto, CRMOrigenLead
import random

NOMBRES = [
    "Juan", "María", "Carlos", "Ana", "Roberto", "Laura", "Diego", "Carmen", 
    "Martín", "Sofía", "Pablo", "Valentina", "Lucas", "Isabella", "Mateo",
    "Camila", "Sebastián", "Victoria", "Alejandro", "Lucía", "Fernando", "Elena",
    "Gabriel", "Daniela", "Ricardo", "Paula", "Andrés", "Natalia", "Jorge", "Adriana"
]

APELLIDOS = [
    "García", "Rodríguez", "Martínez", "López", "González", "Fernández", "Sánchez",
    "Pérez", "Romero", "Torres", "Díaz", "Flores", "Morales", "Castro", "Ruiz",
    "Herrera", "Silva", "Medina", "Ramos", "Vargas", "Ortiz", "Reyes", "Cruz",
    "Gutiérrez", "Mendoza", "Jiménez", "Álvarez", "Navarro", "Molina", "Campos"
]

EMPRESAS = [
    "Inmobiliaria del Sur", "Inversiones Capital", "Grupo Propiedades",
    "Desarrollos Urbanos", "Real Estate Partners", "Inversiones Familiares",
    None, None, None, None  # 60% personas físicas, 40% empresas
]

def crear_contactos():
    session = Session(engine)
    
    # Obtener orígenes y responsables
    origenes = session.exec(select(CRMOrigenLead)).all()
    
    print(f"\n📋 Contactos actuales: {len(session.exec(select(CRMContacto)).all())}")
    print("\n🔨 Creando 30 contactos nuevos...\n")
    
    creados = 0
    for i in range(30):
        try:
            nombre = random.choice(NOMBRES)
            apellido = random.choice(APELLIDOS)
            empresa = random.choice(EMPRESAS)
            
            if empresa:
                nombre_completo = f"{nombre} {apellido} - {empresa}"
            else:
                nombre_completo = f"{nombre} {apellido}"
            
            # Verificar si ya existe
            existe = session.exec(
                select(CRMContacto).where(CRMContacto.nombre_completo == nombre_completo)
            ).first()
            
            if existe:
                continue
            
            # Generar teléfonos
            telefonos = []
            if random.random() > 0.3:  # 70% tiene celular
                telefonos.append(f"+54911{random.randint(2000, 9999)}{random.randint(1000, 9999)}")
            if random.random() > 0.7:  # 30% tiene teléfono adicional
                telefonos.append(f"+5411{random.randint(4000, 5999)}{random.randint(1000, 9999)}")
            
            # Email
            email = None
            if random.random() > 0.2:  # 80% tiene email
                nombre_email = nombre.lower().replace(" ", "")
                apellido_email = apellido.lower().replace(" ", "")
                dominios = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "live.com"]
                email = f"{nombre_email}.{apellido_email}@{random.choice(dominios)}"
            
            # Red social
            red_social = None
            if random.random() > 0.4:  # 60% tiene red social
                redes = ["instagram", "facebook", "linkedin"]
                red_social = f"@{nombre.lower()}.{apellido.lower()}.{random.choice(redes)}"
            
            contacto = CRMContacto(
                nombre_completo=nombre_completo,
                telefonos=telefonos,
                email=email,
                red_social=red_social,
                origen_lead_id=random.choice(origenes).id if origenes else None,
                responsable_id=1,
                notas=random.choice([
                    "Cliente potencial interesado en inversión",
                    "Contacto de referido",
                    "Consulta por redes sociales",
                    "Cliente recurrente",
                    "Inversionista buscando oportunidades",
                    None, None, None  # 60% sin notas
                ])
            )
            
            session.add(contacto)
            session.flush()
            
            print(f"✅ {creados + 1:2d}. {nombre_completo:<40} | Tel: {len(telefonos)} | Email: {'✓' if email else '✗'}")
            creados += 1
            
        except Exception as e:
            session.rollback()
            print(f"❌ Error: {e}")
            continue
    
    if creados > 0:
        session.commit()
    
    total = len(session.exec(select(CRMContacto)).all())
    print(f"\n{'='*70}")
    print(f"✅ Creados: {creados} contactos nuevos")
    print(f"📊 Total en base: {total} contactos")
    print(f"{'='*70}")
    
    session.close()

if __name__ == "__main__":
    print("="*70)
    print("GENERACIÓN DE CONTACTOS")
    print("="*70)
    crear_contactos()
