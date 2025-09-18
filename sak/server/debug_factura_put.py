#!/usr/bin/env python3
"""
Script para debuggear el error 400 en PUT /facturas/1
"""

import requests
import json
from pprint import pprint

def test_put_factura():
    # Primero obtener la factura existente
    print("=== Obteniendo factura actual ===")
    get_response = requests.get('http://localhost:8000/facturas/1')
    if not get_response.ok:
        print(f"Error obteniendo factura: {get_response.status_code}")
        print(get_response.text)
        return
        
    current_data = get_response.json()
    print("Datos actuales de la factura:")
    pprint(current_data)
    
    # Preparar datos para update (simulando lo que enviaría el frontend)
    update_data = {
        "numero": current_data.get("numero", "123"),
        "punto_venta": current_data.get("punto_venta", "0001"),
        "tipo_comprobante": current_data.get("tipo_comprobante", "A"),
        "fecha_emision": current_data.get("fecha_emision", "2024-01-01"),
        "subtotal": float(current_data.get("subtotal", 1000)),
        "total_impuestos": float(current_data.get("total_impuestos", 210)),
        "total": float(current_data.get("total", 1210)),
        "estado": current_data.get("estado", "pendiente"),
        "proveedor_id": current_data.get("proveedor_id", 1),
        "tipo_operacion_id": current_data.get("tipo_operacion_id", 1),
        "usuario_responsable_id": current_data.get("usuario_responsable_id", 1),
        # Agregar campo que podría estar causando problemas
        "ruta_archivo_pdf": current_data.get("ruta_archivo_pdf"),
    }
    
    print("\n=== Datos que se enviarán en PUT ===")
    pprint(update_data)
    
    # Intentar PUT
    print("\n=== Enviando PUT request ===")
    put_response = requests.put(
        'http://localhost:8000/facturas/1', 
        json=update_data,
        headers={'Content-Type': 'application/json'}
    )
    
    print(f"Status Code: {put_response.status_code}")
    print(f"Response Headers: {dict(put_response.headers)}")
    print(f"Response Text: {put_response.text}")
    
    if not put_response.ok:
        try:
            error_data = put_response.json()
            print("Error JSON:")
            pprint(error_data)
        except:
            print("No se pudo parsear el error como JSON")

if __name__ == "__main__":
    test_put_factura()
