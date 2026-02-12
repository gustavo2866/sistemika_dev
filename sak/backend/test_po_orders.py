#!/usr/bin/env python3

import sys
import os

# Agregar directorio actual al PYTHONPATH
sys.path.insert(0, os.path.dirname(__file__))

import uvicorn
from app.main import app
import requests
import time
import threading

def start_server():
    """Función para arrancar el servidor en un hilo separado"""
    uvicorn.run(app, host="127.0.0.1", port=8005, log_level="info")

def test_endpoints():
    """Función para probar los endpoints"""
    base_url = "http://127.0.0.1:8005"
    
    # Esperar a que el servidor arranque
    print("Esperando que el servidor arranque...")
    time.sleep(3)
    
    try:
        # Probar endpoint de health
        print("\n=== Probando endpoint de health ===")
        response = requests.get(f"{base_url}/health")
        print(f"Health status: {response.status_code} - {response.json()}")
        
        # Probar endpoints de po-orders
        print("\n=== Probando endpoints de po-orders ===")
        
        # GET /po-orders - Listar órdenes de compra
        try:
            response = requests.get(f"{base_url}/po-orders")
            print(f"GET /po-orders: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Cantidad de po-orders: {len(data) if isinstance(data, list) else 'N/A'}")
            else:
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"Error en GET /po-orders: {e}")
        
        # GET /po-order-status - Status disponibles
        try:
            response = requests.get(f"{base_url}/po-order-status")
            print(f"GET /po-order-status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Estados disponibles: {len(data) if isinstance(data, list) else 'N/A'}")
                if isinstance(data, list) and len(data) > 0:
                    print(f"Ejemplo de estado: {data[0]}")
            else:
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"Error en GET /po-order-status: {e}")
            
        # GET /po-invoices - Facturas de compra
        try:
            response = requests.get(f"{base_url}/po-invoices")
            print(f"GET /po-invoices: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Cantidad de po-invoices: {len(data) if isinstance(data, list) else 'N/A'}")
            else:
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"Error en GET /po-invoices: {e}")
            
        # GET /po-invoice-status - Estados de facturas
        try:
            response = requests.get(f"{base_url}/po-invoice-status")
            print(f"GET /po-invoice-status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Estados de facturas: {len(data) if isinstance(data, list) else 'N/A'}")
                if isinstance(data, list) and len(data) > 0:
                    print(f"Ejemplo de estado: {data[0]}")
            else:
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"Error en GET /po-invoice-status: {e}")
        
        print("\n=== Prueba de endpoints completada ===")
        
    except Exception as e:
        print(f"Error general: {e}")

if __name__ == "__main__":
    print("Iniciando servidor de pruebas...")
    
    # Arrancar servidor en un hilo
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Probar endpoints
    test_endpoints()
    
    # Mantener el script vivo para inspección manual si es necesario
    print("\nServidor corriendo en http://127.0.0.1:8005")
    print("Presiona Ctrl+C para salir")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nCerrando...")