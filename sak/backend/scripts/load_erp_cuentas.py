#!/usr/bin/env python
"""
Script para cargar datos de cuentas_obra.xlsx a las tablas erp_rubros y erp_cuentas.

Uso:
    python backend/scripts/load_erp_cuentas.py
"""

import sys
from pathlib import Path
from datetime import datetime

# Agregar backend a path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

import openpyxl
from sqlmodel import Session, select
from app.db import engine
from app.models.erp.rubro import ErpRubro
from app.models.erp.cuenta import ErpCuenta


def load_cuentas_from_excel(excel_path: str) -> dict:
    """Lee el archivo Excel y retorna un diccionario de rubros con sus cuentas."""
    wb = openpyxl.load_workbook(excel_path)
    ws = wb.active
    
    rubros_dict = {}
    
    # Saltar header
    for row in list(ws.iter_rows(values_only=True))[1:]:
        rubro_name, nro_cuenta, cod_cuenta, descripcion = row
        
        # Crear rubro si no existe
        if rubro_name not in rubros_dict:
            rubros_dict[rubro_name] = []
        
        # Agregar cuenta al rubro
        rubros_dict[rubro_name].append({
            "nro_cuenta": int(nro_cuenta) if nro_cuenta else 0,
            "cod_cuenta": str(cod_cuenta).strip(),
            "descripcion": str(descripcion).strip() if descripcion else "",
        })
    
    return rubros_dict


def seed_erp_data(excel_path: str):
    """Carga los datos del Excel a la base de datos."""
    
    print(f"Leyendo datos de {excel_path}...")
    rubros_data = load_cuentas_from_excel(excel_path)
    
    print(f"Encontrados {len(rubros_data)} rubros")
    
    with Session(engine) as session:
        # Verificar si ya existen datos
        existing_rubros = session.exec(select(ErpRubro)).all()
        if existing_rubros:
            print(f"\n⚠️  Ya existen {len(existing_rubros)} rubros en la BD.")
            response = input("¿Deseas continuar y agregar/actualizar? (s/n): ").lower()
            if response != "s":
                print("Operación cancelada.")
                return
        
        total_cuentas = 0
        
        for rubro_name, cuentas in rubros_data.items():
            print(f"\nProcesando rubro: '{rubro_name}'")
            
            # Buscar o crear rubro
            stmt = select(ErpRubro).where(ErpRubro.nombre == rubro_name)
            rubro = session.exec(stmt).first()
            
            if not rubro:
                rubro = ErpRubro(
                    nombre=rubro_name,
                    activo=True,
                )
                session.add(rubro)
                session.flush()  # Para obtener el ID
                print(f"  ✓ Rubro creado (id={rubro.id})")
            else:
                print(f"  ℹ Rubro existente (id={rubro.id})")
            
            # Agregar cuentas
            for cuenta_data in cuentas:
                # Verificar si la cuenta ya existe
                stmt_cuenta = select(ErpCuenta).where(
                    ErpCuenta.cod_cuenta == cuenta_data["cod_cuenta"]
                )
                cuenta = session.exec(stmt_cuenta).first()
                
                if not cuenta:
                    cuenta = ErpCuenta(
                        rubro_id=rubro.id,
                        nro_cuenta=cuenta_data["nro_cuenta"],
                        cod_cuenta=cuenta_data["cod_cuenta"],
                        descripcion=cuenta_data["descripcion"],
                        activo=True,
                    )
                    session.add(cuenta)
                    print(f"    ✓ Cuenta: {cuenta_data['cod_cuenta']} - {cuenta_data['descripcion']}")
                    total_cuentas += 1
                else:
                    print(f"    ℹ Cuenta existente: {cuenta_data['cod_cuenta']}")
        
        # Confirmar cambios
        session.commit()
        print(f"\n✅ Datos cargados exitosamente!")
        print(f"   Total de rubros: {len(rubros_data)}")
        print(f"   Total de cuentas agregadas: {total_cuentas}")


if __name__ == "__main__":
    excel_file = "data/cuentas_obra.xlsx"
    
    if not Path(excel_file).exists():
        print(f"❌ Archivo no encontrado: {excel_file}")
        sys.exit(1)
    
    seed_erp_data(excel_file)
