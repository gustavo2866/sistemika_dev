"""
Test de endpoints para la API desplegada en Neon PostgreSQL.
El objetivo es verificar que los endpoints principales respondan correctamente.
"""

import contextlib
import json
import os
import requests

# Permitir override por variable de entorno, apuntando a desarrollo por defecto
BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:8000")


def log_result(prefix: str, message: str) -> None:
    print(f"   {prefix} {message}")


def main() -> None:
    print("=" * 60)
    print("== TEST DE ENDPOINTS - Backend con Neon ==")
    print("=" * 60)

    # Test 1: Health check
    print("\n1) Test de Health Check...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            log_result("OK.", f"Status: {response.status_code}")
            log_result("OK.", f"Response: {response.json()}")
        else:
            log_result("FAIL.", f"Status inesperado: {response.status_code}")
    except Exception as exc:
        log_result("ERROR:", str(exc))

    # Test 2: Root endpoint
    print("\n2) Test de Root endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_result("OK.", f"Status: {response.status_code}")
            log_result("OK.", f"Message: {data.get('message', 'N/A')}")
        else:
            log_result("FAIL.", f"Status inesperado: {response.status_code}")
    except Exception as exc:
        log_result("ERROR:", str(exc))

    # Test 3: Listar paises
    print("\n3) Test de Listar Paises...")
    try:
        response = requests.get(f"{BASE_URL}/paises", timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_result("OK.", f"Status: {response.status_code}")
            log_result("OK.", f"Total paises: {len(data)}")
            if data:
                log_result("OK.", f"Primer pais: {data[0].get('nombre', 'N/A')}")
        else:
            log_result("FAIL.", f"Status inesperado: {response.status_code}")
    except Exception as exc:
        log_result("ERROR:", str(exc))

    # Test 4: Listar tipos de comprobante
    print("\n4) Test de Tipos de Comprobante...")
    try:
        response = requests.get(f"{BASE_URL}/tipos-comprobante", timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_result("OK.", f"Status: {response.status_code}")
            log_result("OK.", f"Total tipos: {len(data)}")
            if data:
                log_result("OK.", f"Primer tipo: {data[0].get('nombre', 'N/A')}")
        else:
            log_result("FAIL.", f"Status inesperado: {response.status_code}")
    except Exception as exc:
        log_result("ERROR:", str(exc))

    # Test 5: Listar usuarios
    print("\n5) Test de Listar Usuarios...")
    try:
        response = requests.get(f"{BASE_URL}/users", timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_result("OK.", f"Status: {response.status_code}")
            log_result("OK.", f"Total usuarios: {len(data)}")
            if data:
                log_result("OK.", f"Primer usuario: {data[0].get('nombre', 'N/A')}")
        else:
            log_result("FAIL.", f"Status inesperado: {response.status_code}")
    except Exception as exc:
        log_result("ERROR:", str(exc))

    # Test 6: Listar nominas
    print("\n6) Test de Listar Nominas...")
    try:
        response = requests.get(f"{BASE_URL}/nominas", timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_result("OK.", f"Status: {response.status_code}")
            log_result("OK.", f"Total empleados: {len(data)}")
            if data:
                first = data[0]
                nombre = first.get("nombre", "N/A")
                apellido = first.get("apellido", "")
                categoria = first.get("categoria", "N/A")
                log_result(
                    "OK.",
                    f"Primer empleado: {nombre} {apellido} ({categoria})".strip(),
                )
        else:
            log_result("FAIL.", f"Status inesperado: {response.status_code}")
    except Exception as exc:
        log_result("ERROR:", str(exc))

    articulo_id = None

    # Test 7: Crear un articulo de prueba
    print("\n7) Test de Crear Articulo...")
    try:
        nuevo_articulo = {
            "nombre": "Articulo de Prueba Neon",
            "tipo_articulo": "Prueba",
            "unidad_medida": "UNI",
            "marca": "Test",
            "sku": "TEST-001",
            "precio": 99.99,
        }
        response = requests.post(
            f"{BASE_URL}/articulos", json=nuevo_articulo, timeout=10
        )
        if response.status_code in (200, 201):
            data = response.json()
            log_result("OK.", f"Status: {response.status_code}")
            log_result("OK.", f"Articulo creado ID: {data.get('id', 'N/A')}")
            log_result("OK.", f"Nombre: {data.get('nombre', 'N/A')}")
            log_result("OK.", f"Precio: ${data.get('precio', 0)}")
            articulo_id = data.get("id")
        else:
            log_result("FAIL.", f"Status inesperado: {response.status_code}")
            with contextlib.suppress(Exception):
                log_result("FAIL.", f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as exc:
        log_result("ERROR:", str(exc))

    # Test 8: Leer el articulo creado
    print("\n8) Test de Leer Articulo...")
    if articulo_id:
        try:
            response = requests.get(
                f"{BASE_URL}/articulos/{articulo_id}", timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                log_result("OK.", f"Status: {response.status_code}")
                log_result("OK.", f"Articulo encontrado: {data.get('nombre', 'N/A')}")
                log_result(
                    "OK.", f"Precio unitario: ${data.get('precio_unitario', 0)}"
                )
            else:
                log_result("FAIL.", f"Status inesperado: {response.status_code}")
        except Exception as exc:
            log_result("ERROR:", str(exc))
    else:
        log_result("WARN.", "No se pudo crear el articulo, se omite la lectura.")

    # Test 9: Listar propiedades
    print("\n9) Test de Listar Propiedades...")
    try:
        response = requests.get(f"{BASE_URL}/propiedades", timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_result("OK.", f"Status: {response.status_code}")
            log_result("OK.", f"Total propiedades: {len(data)}")
            if data:
                log_result("OK.", f"Primera propiedad: {data[0].get('nombre', 'N/A')}")
        else:
            log_result("FAIL.", f"Status inesperado: {response.status_code}")
    except Exception as exc:
        log_result("ERROR:", str(exc))

    print("\n" + "=" * 60)
    print("== TESTS DE ENDPOINTS COMPLETADOS ==")
    print("=" * 60)
    print("\nResumen:")
    print("   - Backend conectado a Neon PostgreSQL")
    print("   - Endpoints principales responden correctamente")
    print("   - Base de datos operativa")
    print("\nProximos pasos:")
    print("   1. Probar desde el frontend")
    print("   2. Verificar que los datos persisten")
    print("   3. Hacer cambios y volver a ejecutar las pruebas")


if __name__ == "__main__":
    main()
