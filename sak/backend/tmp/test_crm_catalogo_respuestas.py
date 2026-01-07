"""
Crear y listar CRMCatalogoRespuesta usando Session
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from sqlmodel import Session
from app.db import engine
from app.models import CRMCatalogoRespuesta

with Session(engine) as session:
    # crear
    resp = CRMCatalogoRespuesta(titulo="Prueba", texto="Texto de prueba")
    session.add(resp)
    session.commit()
    session.refresh(resp)
    print(f"Creado ID: {resp.id}, titulo: {resp.titulo}")

    # listar
    items = session.exec("SELECT * FROM crm_catalogo_respuestas").all()
    print(f"Total filas en tabla: {len(items)}")
    for it in items:
        print(it)
