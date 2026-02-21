#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para verificar estados de propiedades
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import os

load_dotenv()

def main():
    database_url = os.getenv('DATABASE_URL').replace('postgresql+psycopg://', 'postgresql://')
    
    conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
    
    try:
        with conn.cursor() as cur:
            # Ver los estados disponibles
            cur.execute('SELECT id, nombre, descripcion, orden FROM propiedades_status ORDER BY orden')
            estados = cur.fetchall()
            
            print('Estados disponibles en propiedades_status:')
            print('ID | Nombre           | Descripción')
            print('-' * 50)
            for e in estados:
                print(f'{e["id"]:2} | {e["nombre"]:15} | {e["descripcion"] or ""}')
            
            print()
            
            # Ver cuántas propiedades usan cada estado en el campo string
            cur.execute('''
                SELECT estado, COUNT(*) as cantidad 
                FROM propiedades 
                GROUP BY estado 
                ORDER BY cantidad DESC
            ''')
            estados_usados = cur.fetchall()
            
            print('Estados usados actualmente (campo string):')
            print('Estado           | Cantidad')
            print('-' * 30)
            for e in estados_usados:
                print(f'{e["estado"]:15} | {e["cantidad"]}')
                
            # Ver mapeo entre campos estado y propiedad_status_id
            print('\nMapeo entre estado string y propiedad_status_id:')
            print('-' * 60)
            cur.execute('''
                SELECT p.estado, p.propiedad_status_id, ps.nombre as status_nombre, COUNT(*) as cantidad
                FROM propiedades p
                LEFT JOIN propiedades_status ps ON p.propiedad_status_id = ps.id
                GROUP BY p.estado, p.propiedad_status_id, ps.nombre
                ORDER BY p.estado, p.propiedad_status_id
            ''')
            mapeo = cur.fetchall()
            
            for m in mapeo:
                status_id = m["propiedad_status_id"] if m["propiedad_status_id"] else "NULL"
                status_nombre = m["status_nombre"] if m["status_nombre"] else "Sin estado"
                print(f'{m["estado"]:15} -> ID:{status_id:2} ({status_nombre:15}) | {m["cantidad"]} registros')
            
    finally:
        conn.close()

if __name__ == "__main__":
    main()