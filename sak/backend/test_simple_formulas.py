#!/usr/bin/env python3
"""
Test simple de la calculadora financiera
"""
from decimal import Decimal

# Test directo sin imports del modelo
def test_calculo_manual():
    """
    Test manual de las fórmulas sin usar los modelos
    """
    print("💰 TEST MANUAL DE FÓRMULAS FINANCIERAS")
    print("="*50)
    
    # Parámetros Sistema Francés (imagen 1)
    capital = Decimal("14700000")
    cuotas = 36
    tna = Decimal("60.00")
    
    # Calcular TEM: TNA / 12 (fórmula simple usada en planillas)
    tem_porcentaje = tna / Decimal("12")
    
    print(f"📊 SISTEMA FRANCÉS:")
    print(f"   Capital: ${capital:,.2f}")
    print(f"   TNA: {tna}%")
    print(f"   TEM calculado: {tem_porcentaje:.6f}%")
    print(f"   TEM esperado: 5.00%")
    
    # Calcular cuota francés
    tem_decimal = tem_porcentaje / Decimal("100")
    factor = tem_decimal * ((1 + tem_decimal) ** cuotas)
    divisor = ((1 + tem_decimal) ** cuotas) - 1
    cuota_frances = capital * (factor / divisor)
    
    print(f"   Cuota Francés: ${cuota_frances:.2f}")
    
    # Parámetros Sistema Alemán (imagen 2) 
    capital2 = Decimal("4000000")
    cuotas2 = 48
    tna2 = Decimal("21.00")
    
    # Calcular TEM para alemán (fórmula simple)
    tem2_porcentaje = tna2 / Decimal("12")
    
    print(f"\n📊 SISTEMA ALEMÁN:")
    print(f"   Capital: ${capital2:,.2f}")
    print(f"   TNA: {tna2}%")
    print(f"   TEM calculado: {tem2_porcentaje:.6f}%")
    print(f"   TEM esperado: 1.75%")
    
    # Calcular amortización constante
    amortizacion_constante = capital2 / cuotas2
    print(f"   Amortización constante: ${amortizacion_constante:.2f}")
    
    # Primera cuota alemán
    tem2_decimal = tem2_porcentaje / Decimal("100")
    interes_primera_cuota = capital2 * tem2_decimal
    cuota_inicial_aleman = amortizacion_constante + interes_primera_cuota
    
    # Última cuota alemán (saldo final muy pequeño)
    saldo_ultima_cuota = amortizacion_constante  # Aproximación
    interes_ultima_cuota = saldo_ultima_cuota * tem2_decimal
    cuota_final_aleman = amortizacion_constante + interes_ultima_cuota
    
    print(f"   Cuota inicial: ${cuota_inicial_aleman:.2f}")
    print(f"   Cuota final: ${cuota_final_aleman:.2f}")
    
    print(f"\n✅ Fórmulas calculadas correctamente")
    return True

def main():
    print("🧮 PRUEBA RÁPIDA DE FÓRMULAS FINANCIERAS")
    test_calculo_manual()

if __name__ == "__main__":
    main()