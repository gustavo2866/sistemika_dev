#!/usr/bin/env python3
"""
Test directo del servicio de calculadora (sin API)
"""
from decimal import Decimal
from app.schemas.financiero import CalculoRequest, SistemaCalculo
from app.services.calculador_financiero import CalculadorFinanciero

def test_frances_directo():
    """Test directo del sistema francés"""
    print("🇫🇷 Test Sistema Francés - Directo")
    print("-" * 40)
    
    # Datos del Excel: $14.7M, 36 meses, 60% TNA
    req = CalculoRequest(
        capital=Decimal("14700000"),
        plazo_meses=36,
        tna=Decimal("60.0"),
        sistema=SistemaCalculo.FRANCES
    )
    
    calc = CalculadorFinanciero()
    result = calc.calcular_resumen(req)
    
    print(f"Capital: ${result.capital:,.0f}")
    print(f"Plazo: {result.plazo_meses} meses")
    print(f"TNA: {result.tna}%")
    print(f"TEM: {result.tem}%")
    print(f"Cuota inicial: ${result.cuota_inicial:,.0f}")
    print(f"Total intereses: ${result.total_intereses:,.0f}")
    print(f"Total a pagar: ${result.total_a_pagar:,.0f}")

def test_aleman_directo():
    """Test directo del sistema alemán"""
    print("\n🇩🇪 Test Sistema Alemán - Directo")
    print("-" * 40)
    
    # Datos del Excel: $4M, 48 meses, 21% TNA
    req = CalculoRequest(
        capital=Decimal("4000000"),
        plazo_meses=48,
        tna=Decimal("21.0"),
        sistema=SistemaCalculo.ALEMAN
    )
    
    calc = CalculadorFinanciero()
    result = calc.calcular_resumen(req)
    
    print(f"Capital: ${result.capital:,.0f}")
    print(f"Plazo: {result.plazo_meses} meses")
    print(f"TNA: {result.tna}%")
    print(f"TEM: {result.tem}%")
    print(f"Primera cuota: ${result.cuota_inicial:,.0f}")
    print(f"Última cuota: ${result.cuota_final:,.0f}")
    print(f"Total intereses: ${result.total_intereses:,.0f}")
    print(f"Total a pagar: ${result.total_a_pagar:,.0f}")

if __name__ == "__main__":
    try:
        print("🧮 Test Directo - Calculadora Financiera")
        print("=" * 50)
        
        test_frances_directo()
        test_aleman_directo()
        
        print("\n✅ Tests directos completados exitosamente")
        
    except Exception as e:
        print(f"\n❌ Error en test directo: {e}")
        import traceback
        traceback.print_exc()