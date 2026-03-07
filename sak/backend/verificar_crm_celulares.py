#!/usr/bin/env python3
"""
Script para verificar datos en la tabla crm_celulares
"""
import os
import sys
from pathlib import Path

# Agregar el directorio backend al path para importar los modelos
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))

from sqlmodel import Session, select, func
from app.db import engine
from app.models.crm.celular import CRMCelular

def verificar_datos_crm_celulares():
    """Verifica si hay datos en la tabla crm_celulares"""
    
    try:
        with Session(engine) as session:
            # Contar registros totales
            count_stmt = select(func.count()).select_from(CRMCelular)
            total_registros = session.exec(count_stmt).one()
            
            print(f"📊 Total de registros en crm_celulares: {total_registros}")
            
            if total_registros == 0:
                print("❌ La tabla crm_celulares está vacía")
                return
                
            # Obtener algunos registros de ejemplo
            stmt = select(CRMCelular).limit(5)
            celulares = session.exec(stmt).all()
            
            print("📋 Registros encontrados:")
            print("-" * 80)
            for celular in celulares:
                print(f"ID: {celular.id}")
                print(f"Meta Celular ID: {celular.meta_celular_id}")
                print(f"Número: {celular.numero_celular}")
                print(f"Alias: {celular.alias}")
                print(f"Activo: {celular.activo}")
                print(f"Creado: {celular.created_at}")
                print("-" * 40)
                
            # Verificar registros activos vs inactivos
            stmt_activos = select(func.count()).select_from(CRMCelular).where(CRMCelular.activo == True)
            stmt_inactivos = select(func.count()).select_from(CRMCelular).where(CRMCelular.activo == False)
            
            activos = session.exec(stmt_activos).one()
            inactivos = session.exec(stmt_inactivos).one()
            
            print(f"✅ Celulares activos: {activos}")
            print(f"❌ Celulares inactivos: {inactivos}")
            
    except Exception as e:
        print(f"❌ Error al consultar la base de datos: {e}")
        print(f"Tipo de error: {type(e).__name__}")
        
if __name__ == "__main__":
    print("🔍 Verificando datos en la tabla crm_celulares...")
    verificar_datos_crm_celulares()