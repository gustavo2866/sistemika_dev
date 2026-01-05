"""
Verificar qué está pasando exactamente con la URL del frontend
"""
import requests
import json
from urllib.parse import unquote, parse_qs, urlparse

# URL completa del frontend
url = "http://localhost:8000/crm/oportunidades?filter=%7B%22panel_window_days%22%3A30%2C%22activo%22%3Atrue%2C%22responsable_id%22%3A1%2C%22contacto_id%22%3A%2274%22%7D&range=%5B0%2C9%5D&sort=%5B%22id%22%2C%22DESC%22%5D"

# Parsear URL
parsed = urlparse(url)
params = parse_qs(parsed.query)

print("=== Análisis de la URL del frontend ===\n")
print(f"Path: {parsed.path}")
print(f"\nParámetros:")
for key, value in params.items():
    decoded = unquote(value[0])
    print(f"  {key}: {decoded}")
    
# Decodificar filtro
filtro_str = unquote(params['filter'][0])
filtro = json.loads(filtro_str)

print(f"\n=== Filtros decodificados ===")
for key, value in filtro.items():
    print(f"  {key}: {value} (tipo: {type(value).__name__})")

print(f"\n=== Análisis ===")
print("Los filtros 'panel_window_days', 'activo' y 'responsable_id' NO están")
print("definidos en el componente crm-oportunidades/list.tsx")
print("\nPosibles fuentes:")
print("  1. LocalStorage de React Admin guardó filtros de otra vista (CRM Panel)")
print("  2. La URL fue compartida desde otra vista")
print("  3. Hay un redirect o navegación que preserva filtros")
print("  4. Estás accediendo a través de un link que tiene esos parámetros")

print(f"\n=== Solución ===")
print("Accede directamente a: http://localhost:3000/crm/oportunidades")
print("Sin parámetros en la URL, para limpiar los filtros del localStorage")
