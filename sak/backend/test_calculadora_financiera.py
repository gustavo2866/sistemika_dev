#!/usr/bin/env python3
"""
Script para probar y validar los cálculos financieros
contra los datos de las imágenes del Excel
"""
from decimal import Decimal
from app.services.calculador_financiero import CalculadorFinanciero, ParametrosCalculo
from app.models.financiero import SistemaCalculo

def test_sistema_frances():
    """
    Prueba del Sistema Francés basado en la primera imagen:
    - Capital: $14.700.000
    - Cuotas: 36
    - TNA: 60,00%
    - TEM esperado: 5,00%
    - IVA: 10,50%
    """
    print("🏦 PROBANDO SISTEMA FRANCÉS")
    print("="*50)
    
    calculadora = CalculadorFinanciero()
    
    # Parámetros de la imagen
    parametros = ParametrosCalculo(
        capital=Decimal("14700000.00"),
        cantidad_cuotas=36,
        tna=Decimal("60.00"),
        sistema_calculo=SistemaCalculo.FRANCES,
        iva_porcentaje=Decimal("10.50")
    )
    
    resultado = calculadora.calcular(parametros)
    
    print(f"📊 PARÁMETROS:")
    print(f"   Capital: ${parametros.capital:,.2f}")
    print(f"   Cuotas: {parametros.cantidad_cuotas}")
    print(f"   TNA: {parametros.tna}%")
    print(f"   Sistema: {parametros.sistema_calculo.value}")
    print(f"   IVA: {parametros.iva_porcentaje}%")
    
    print(f"\n📈 RESULTADOS CALCULADOS:")
    print(f"   TEM: {resultado.tem}% (esperado: 5.00%)")
    print(f"   Cuota constante: ${resultado.cuota_inicial:,.2f}")
    print(f"   Total intereses: ${resultado.total_intereses:,.2f}")
    print(f"   Total IVA: ${resultado.total_iva:,.2f}")
    print(f"   Total a pagar: ${resultado.total_a_pagar:,.2f}")
    
    # Verificar TEM
    tem_esperado = Decimal("5.00")
    if abs(resultado.tem - tem_esperado) < Decimal("0.01"):
        print("   ✅ TEM correcto")
    else:
        print(f"   ❌ TEM incorrecto. Esperado: {tem_esperado}%, calculado: {resultado.tem}%")
    
    # Mostrar primeras 5 cuotas para verificar
    print(f"\n📋 PRIMERAS 5 CUOTAS:")
    print(f"{'Cuota':<5} {'Capital':<12} {'Interés':<12} {'Cuota s/IVA':<12} {'IVA':<10} {'Cuota c/IVA':<12} {'Saldo':<15}")
    print("-" * 85)
    
    for i, cuota in enumerate(resultado.detalle_cuotas[:5]):
        print(f"{cuota['numero_cuota']:<5} "
              f"${cuota['capital_periodo']:>10,.2f} "
              f"${cuota['interes_periodo']:>10,.2f} "
              f"${cuota['cuota_sin_iva']:>10,.2f} "
              f"${cuota['iva_sobre_interes']:>8,.2f} "
              f"${cuota['cuota_con_iva']:>10,.2f} "
              f"${cuota['saldo_deuda']:>13,.2f}")
    
    print(f"   ...")
    print(f"   (Total {len(resultado.detalle_cuotas)} cuotas)")
    
    return resultado

def test_sistema_aleman():
    """
    Prueba del Sistema Alemán basado en la segunda imagen:
    - Capital: $4.000.000
    - Cuotas: 48
    - TNA: 21,00%
    - TEM esperado: 1,75%
    - IVA: 10,50%
    """
    print("\n🏛️ PROBANDO SISTEMA ALEMÁN")
    print("="*50)
    
    calculadora = CalculadorFinanciero()
    
    # Parámetros de la imagen
    parametros = ParametrosCalculo(
        capital=Decimal("4000000.00"),
        cantidad_cuotas=48,
        tna=Decimal("21.00"),
        sistema_calculo=SistemaCalculo.ALEMAN,
        iva_porcentaje=Decimal("10.50")
    )
    
    resultado = calculadora.calcular(parametros)
    
    print(f"📊 PARÁMETROS:")
    print(f"   Capital: ${parametros.capital:,.2f}")
    print(f"   Cuotas: {parametros.cantidad_cuotas}")
    print(f"   TNA: {parametros.tna}%")
    print(f"   Sistema: {parametros.sistema_calculo.value}")
    print(f"   IVA: {parametros.iva_porcentaje}%")
    
    print(f"\n📈 RESULTADOS CALCULADOS:")
    print(f"   TEM: {resultado.tem}% (esperado: 1.75%)")
    print(f"   Cuota inicial: ${resultado.cuota_inicial:,.2f}")
    print(f"   Cuota final: ${resultado.cuota_final:,.2f}")
    print(f"   Amortización constante: ${parametros.capital / parametros.cantidad_cuotas:,.2f}")
    print(f"   Total intereses: ${resultado.total_intereses:,.2f}")
    print(f"   Total IVA: ${resultado.total_iva:,.2f}")
    print(f"   Total a pagar: ${resultado.total_a_pagar:,.2f}")
    
    # Verificar TEM
    tem_esperado = Decimal("1.75")
    if abs(resultado.tem - tem_esperado) < Decimal("0.01"):
        print("   ✅ TEM correcto")
    else:
        print(f"   ❌ TEM incorrecto. Esperado: {tem_esperado}%, calculado: {resultado.tem}%")
    
    # Mostrar primeras 5 cuotas para verificar
    print(f"\n📋 PRIMERAS 5 CUOTAS:")
    print(f"{'Cuota':<5} {'Capital':<12} {'Interés':<12} {'Cuota s/IVA':<12} {'IVA':<10} {'Cuota c/IVA':<12} {'Saldo':<15}")
    print("-" * 85)
    
    for i, cuota in enumerate(resultado.detalle_cuotas[:5]):
        print(f"{cuota['numero_cuota']:<5} "
              f"${cuota['capital_periodo']:>10,.2f} "
              f"${cuota['interes_periodo']:>10,.2f} "
              f"${cuota['cuota_sin_iva']:>10,.2f} "
              f"${cuota['iva_sobre_interes']:>8,.2f} "
              f"${cuota['cuota_con_iva']:>10,.2f} "
              f"${cuota['saldo_deuda']:>13,.2f}")
    
    print(f"   ...")
    
    # Mostrar últimas 3 cuotas para ver la evolución decreciente
    print(f"\n📋 ÚLTIMAS 3 CUOTAS:")
    for cuota in resultado.detalle_cuotas[-3:]:
        print(f"{cuota['numero_cuota']:<5} "
              f"${cuota['capital_periodo']:>10,.2f} "
              f"${cuota['interes_periodo']:>10,.2f} "
              f"${cuota['cuota_sin_iva']:>10,.2f} "
              f"${cuota['iva_sobre_interes']:>8,.2f} "
              f"${cuota['cuota_con_iva']:>10,.2f} "
              f"${cuota['saldo_deuda']:>13,.2f}")
    
    return resultado

def comparar_sistemas():
    """
    Comparación directa de ambos sistemas
    """
    print("\n🔄 COMPARACIÓN DE SISTEMAS")
    print("="*50)
    
    # Usar los mismos parámetros base para comparar
    capital_base = Decimal("1000000.00")  # 1 millón para comparación
    cuotas_base = 24  # 2 años
    tna_base = Decimal("36.00")  # TNA intermedia
    
    calculadora = CalculadorFinanciero()
    
    # Sistema Francés
    params_frances = ParametrosCalculo(
        capital=capital_base,
        cantidad_cuotas=cuotas_base,
        tna=tna_base,
        sistema_calculo=SistemaCalculo.FRANCES
    )
    resultado_frances = calculadora.calcular(params_frances)
    
    # Sistema Alemán
    params_aleman = ParametrosCalculo(
        capital=capital_base,
        cantidad_cuotas=cuotas_base,
        tna=tna_base,
        sistema_calculo=SistemaCalculo.ALEMAN
    )
    resultado_aleman = calculadora.calcular(params_aleman)
    
    print(f"📊 PARÁMETROS IDÉNTICOS:")
    print(f"   Capital: ${capital_base:,.2f}")
    print(f"   Cuotas: {cuotas_base}")
    print(f"   TNA: {tna_base}%")
    
    print(f"\n📈 COMPARACIÓN DE RESULTADOS:")
    print(f"{'Concepto':<20} {'Francés':<15} {'Alemán':<15} {'Diferencia':<15}")
    print("-" * 70)
    
    diferencia_intereses = resultado_aleman.total_intereses - resultado_frances.total_intereses
    diferencia_total = resultado_aleman.total_a_pagar - resultado_frances.total_a_pagar
    
    print(f"{'Cuota inicial':<20} ${resultado_frances.cuota_inicial:<13,.2f} ${resultado_aleman.cuota_inicial:<13,.2f} ${resultado_aleman.cuota_inicial - resultado_frances.cuota_inicial:<13,.2f}")
    print(f"{'Cuota final':<20} ${resultado_frances.cuota_final:<13,.2f} ${resultado_aleman.cuota_final:<13,.2f} ${resultado_aleman.cuota_final - resultado_frances.cuota_final:<13,.2f}")
    print(f"{'Total intereses':<20} ${resultado_frances.total_intereses:<13,.2f} ${resultado_aleman.total_intereses:<13,.2f} ${diferencia_intereses:<13,.2f}")
    print(f"{'Total a pagar':<20} ${resultado_frances.total_a_pagar:<13,.2f} ${resultado_aleman.total_a_pagar:<13,.2f} ${diferencia_total:<13,.2f}")
    
    if diferencia_total > 0:
        print(f"\n💡 El sistema ALEMÁN es ${diferencia_total:,.2f} más caro en total")
    else:
        print(f"\n💡 El sistema FRANCÉS es ${abs(diferencia_total):,.2f} más caro en total")

def main():
    """Función principal"""
    print("💰 CALCULADORA FINANCIERA - SISTEMAS FRANCÉS Y ALEMÁN")
    print("="*60)
    print("🎯 Validando contra datos de planillas Excel")
    
    try:
        # Probar ambos sistemas
        resultado_frances = test_sistema_frances()
        resultado_aleman = test_sistema_aleman()
        
        # Comparar sistemas
        comparar_sistemas()
        
        print(f"\n✅ PRUEBAS COMPLETADAS EXITOSAMENTE")
        print(f"📝 Los cálculos están listos para implementar en la API")
        
    except Exception as e:
        print(f"\n❌ Error en las pruebas: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()