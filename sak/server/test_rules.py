#!/usr/bin/env python3
"""
Test directo simplificado
"""
import re
import os

def test_rules():
    # Texto del PDF que vimos
    text_content = """ORIGINAL
C
FACTURA
GUZZANTI MIGUEL ANGEL
COD. 011
Punto de Venta: 00002 Comp. Nro: 00000553
Razón Social: GUZZANTI MIGUEL ANGEL Fecha de Emisión: 02/09/2025
Domicilio Comercial: 159 4228 - Platanos, Buenos Aires CUIT: 20222387753
Ingresos Brutos: 20222387753
Condición frente al IVA: Responsable Monotributo Fecha de Inicio de Actividades: 01/12/2008
Período Facturado Desde: 01/08/2025 Hasta:31/08/2025 Fecha de Vto. para el pago:02/09/2025
CUIT: 30707407367 Apellido y Nombre / Razón Social:EXCELENCIA EN SOLUCIONES INFORMATICAS SA
Condición frente al IVA: IVA Responsable Inscripto Domicilio:Caseros Av. 3515 Piso:5 - Capital Federal, Ciudad de Buenos
Aires
Condición de venta: Cuenta Corriente
Código Producto / Servicio Cantidad U. Medida Precio Unit. % Bonif Imp. Bonif. Subtotal
viajes en provincia de bs as 1,00 unidades 546200,00 0,00 0,00 546200,00
Subtotal: $ 546200,00
Importe Otros Tributos: $ 0,00
Importe Total: $ 546200,00"""

    result = {
        "numero": "",
        "proveedor_nombre": "",
        "proveedor_cuit": "",
        "fecha_emision": "",
        "total": 0.0,
        "tipo_comprobante": "",
    }
    
    # Test número
    numero_match = re.search(r'Comp\.\s*Nro\s*:?\s*(\d+)', text_content, re.IGNORECASE)
    if numero_match:
        result["numero"] = numero_match.group(1)
    
    # Test proveedor (buscar después de FACTURA)
    lines = [line.strip() for line in text_content.split('\n') if line.strip()]
    factura_found = False
    for line in lines:
        line_upper = line.upper()
        if line_upper == "FACTURA":
            factura_found = True
            continue
        if factura_found and line and len(line) > 3:
            skip_keywords = ['ORIGINAL', 'DUPLICADO', 'TRIPLICADO', 'TIPO', 'COD.', 'PUNTO', 'COMP.']
            if not any(keyword in line_upper for keyword in skip_keywords):
                if not re.match(r'^[A-Z]{1,3}\s*\d*$', line_upper):
                    result["proveedor_nombre"] = line
                    break
    
    # Test CUIT
    cuit_match = re.search(r'CUIT:\s*(\d{11})', text_content)
    if cuit_match:
        result["proveedor_cuit"] = cuit_match.group(1)
    
    # Test fecha
    fecha_match = re.search(r'Fecha de Emisión:\s*(\d{2}/\d{2}/\d{4})', text_content)
    if fecha_match:
        fecha = fecha_match.group(1)
        day, month, year = fecha.split('/')
        result["fecha_emision"] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    
    # Test total
    total_match = re.search(r'Importe\s*Total\s*:\s*\$\s*(\d+,\d{2})', text_content)
    if total_match:
        total_str = total_match.group(1).replace(',', '.')
        result["total"] = float(total_str)
    
    # Test tipo
    if 'FACTURA' in text_content.upper():
        result["tipo_comprobante"] = "C"  # Del PDF vemos que es tipo C
    
    print("Resultados de la extracción mejorada:")
    print("=" * 40)
    for key, value in result.items():
        print(f"{key}: {value}")

if __name__ == "__main__":
    test_rules()
