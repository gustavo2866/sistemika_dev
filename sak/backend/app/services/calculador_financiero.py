"""
Servicio para cálculos financieros de préstamos
Implementa sistemas Francés y Alemán con IVA
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any
from dataclasses import dataclass

from app.schemas.financiero import SistemaCalculo, CalculoRequest, CalculoResponse, DetalleCuotaResponse, ResumenCalculoResponse


@dataclass
class ParametrosCalculo:
    """Parámetros para realizar un cálculo de préstamo"""
    capital: Decimal
    plazo_meses: int
    tna: Decimal  # Tasa Nominal Anual en %
    sistema: SistemaCalculo
    iva_porcentaje: Decimal = Decimal("10.50")

    @classmethod
    def from_request(cls, request: CalculoRequest):
        """Crear desde un request de la API"""
        return cls(
            capital=request.capital,
            plazo_meses=request.plazo_meses,
            tna=request.tna,
            sistema=request.sistema,
            iva_porcentaje=request.iva_porcentaje
        )


@dataclass
class ResultadoCalculo:
    """Resultado de un cálculo de préstamo"""
    tem: Decimal
    cuota_inicial: Decimal
    cuota_final: Decimal
    total_intereses: Decimal
    total_iva: Decimal
    total_a_pagar: Decimal
    detalle_cuotas: List[Dict[str, Any]]


class CalculadorFinanciero:
    """
    Calculadora de préstamos para sistemas Francés y Alemán
    """
    
    @staticmethod
    def calcular_tem(tna: Decimal) -> Decimal:
        """
        Calcula la Tasa Efectiva Mensual a partir de la TNA
        Usando fórmula simple: TEM = TNA / 12 (más común en sistemas financieros)
        Para cálculo compuesto usar: TEM = (1 + TNA)^(1/12) - 1
        """
        # Usar fórmula simple que parece coincidir mejor con las planillas
        tem_porcentaje = tna / Decimal("12")
        return tem_porcentaje.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
    
    @staticmethod
    def redondear_moneda(valor: Decimal) -> Decimal:
        """Redondea un valor monetario a 2 decimales"""
        return valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    @staticmethod
    def calcular_iva(interes: Decimal, iva_porcentaje: Decimal) -> Decimal:
        """Calcula el IVA sobre un interés"""
        iva = interes * (iva_porcentaje / Decimal("100"))
        return CalculadorFinanciero.redondear_moneda(iva)
    
    def calcular_sistema_frances(self, parametros: ParametrosCalculo) -> ResultadoCalculo:
        """
        Calcula préstamo con sistema Francés (cuotas constantes)
        
        Fórmulas:
        - TEM = (1 + TNA)^(1/12) - 1
        - Cuota = Capital × [TEM × (1+TEM)^n] / [(1+TEM)^n - 1]
        - Interés = Saldo × TEM
        - Amortización = Cuota - Interés
        """
        capital = parametros.capital
        n = parametros.plazo_meses
        tem_porcentaje = self.calcular_tem(parametros.tna)
        tem_decimal = tem_porcentaje / Decimal("100")
        
        # Calcular cuota constante (sin IVA)
        factor = tem_decimal * ((1 + tem_decimal) ** n)
        divisor = ((1 + tem_decimal) ** n) - 1
        cuota_constante = capital * (factor / divisor)
        cuota_constante = self.redondear_moneda(cuota_constante)
        
        # Generar tabla de cuotas
        detalle_cuotas = []
        saldo_deuda = capital
        capital_acumulado = Decimal("0")
        total_intereses = Decimal("0")
        total_iva = Decimal("0")
        
        for i in range(1, n + 1):
            # Cálculos de la cuota
            interes_periodo = self.redondear_moneda(saldo_deuda * tem_decimal)
            capital_periodo = self.redondear_moneda(cuota_constante - interes_periodo)
            
            # Ajuste en la última cuota para cerrar exactamente
            if i == n:
                capital_periodo = saldo_deuda
                cuota_sin_iva = capital_periodo + interes_periodo
            else:
                cuota_sin_iva = cuota_constante
            
            # IVA e impuestos
            iva_sobre_interes = self.calcular_iva(interes_periodo, parametros.iva_porcentaje)
            cuota_con_iva = cuota_sin_iva + iva_sobre_interes
            
            # Actualizar acumulados
            capital_acumulado += capital_periodo
            saldo_deuda -= capital_periodo
            total_intereses += interes_periodo
            total_iva += iva_sobre_interes
            
            # Guardar detalle de la cuota
            detalle_cuotas.append({
                "numero_cuota": i,
                "capital_periodo": capital_periodo,
                "interes_periodo": interes_periodo,
                "cuota_sin_iva": cuota_sin_iva,
                "iva_sobre_interes": iva_sobre_interes,
                "cuota_con_iva": cuota_con_iva,
                "amortizacion_acumulada": capital_acumulado,
                "capital_acumulado": capital_acumulado,
                "saldo_deuda": self.redondear_moneda(saldo_deuda)
            })
        
        # Resumen del cálculo
        total_a_pagar = capital + total_intereses + total_iva
        
        return ResultadoCalculo(
            tem=tem_porcentaje,
            cuota_inicial=cuota_constante,
            cuota_final=cuota_constante,
            total_intereses=total_intereses,
            total_iva=total_iva,
            total_a_pagar=total_a_pagar,
            detalle_cuotas=detalle_cuotas
        )
    
    def calcular_sistema_aleman(self, parametros: ParametrosCalculo) -> ResultadoCalculo:
        """
        Calcula préstamo con sistema Alemán (cuotas decrecientes)
        
        Fórmulas:
        - Amortización constante = Capital / n
        - Interés = Saldo × TEM
        - Cuota = Amortización + Interés
        """
        capital = parametros.capital
        n = parametros.plazo_meses
        tem_porcentaje = self.calcular_tem(parametros.tna)
        tem_decimal = tem_porcentaje / Decimal("100")
        
        # Amortización constante
        amortizacion_constante = self.redondear_moneda(capital / n)
        
        # Generar tabla de cuotas
        detalle_cuotas = []
        saldo_deuda = capital
        capital_acumulado = Decimal("0")
        total_intereses = Decimal("0")
        total_iva = Decimal("0")
        cuota_inicial = None
        cuota_final = None
        
        for i in range(1, n + 1):
            # Cálculos de la cuota
            interes_periodo = self.redondear_moneda(saldo_deuda * tem_decimal)
            
            # Ajuste en la última cuota para cerrar exactamente
            if i == n:
                capital_periodo = saldo_deuda
            else:
                capital_periodo = amortizacion_constante
            
            cuota_sin_iva = capital_periodo + interes_periodo
            
            # Guardar primera y última cuota
            if i == 1:
                cuota_inicial = cuota_sin_iva
            if i == n:
                cuota_final = cuota_sin_iva
            
            # IVA e impuestos
            iva_sobre_interes = self.calcular_iva(interes_periodo, parametros.iva_porcentaje)
            cuota_con_iva = cuota_sin_iva + iva_sobre_interes
            
            # Actualizar acumulados
            capital_acumulado += capital_periodo
            saldo_deuda -= capital_periodo
            total_intereses += interes_periodo
            total_iva += iva_sobre_interes
            
            # Guardar detalle de la cuota
            detalle_cuotas.append({
                "numero_cuota": i,
                "capital_periodo": capital_periodo,
                "interes_periodo": interes_periodo,
                "cuota_sin_iva": cuota_sin_iva,
                "iva_sobre_interes": iva_sobre_interes,
                "cuota_con_iva": cuota_con_iva,
                "amortizacion_acumulada": capital_acumulado,
                "capital_acumulado": capital_acumulado,
                "saldo_deuda": self.redondear_moneda(saldo_deuda)
            })
        
        # Resumen del cálculo
        total_a_pagar = capital + total_intereses + total_iva
        
        return ResultadoCalculo(
            tem=tem_porcentaje,
            cuota_inicial=cuota_inicial,
            cuota_final=cuota_final,
            total_intereses=total_intereses,
            total_iva=total_iva,
            total_a_pagar=total_a_pagar,
            detalle_cuotas=detalle_cuotas
        )
    
    def calcular_completo(self, parametros: ParametrosCalculo) -> CalculoResponse:
        """
        Método principal que calcula y devuelve response completo para API
        """
        resultado = self.calcular(parametros)
        
        # Convertir a response model
        detalle_cuotas = [
            DetalleCuotaResponse(**cuota) for cuota in resultado.detalle_cuotas
        ]
        
        return CalculoResponse(
            capital=parametros.capital,
            plazo_meses=parametros.plazo_meses,
            tna=parametros.tna,
            sistema=parametros.sistema,
            iva_porcentaje=parametros.iva_porcentaje,
            tem=resultado.tem,
            cuota_inicial=resultado.cuota_inicial,
            cuota_final=resultado.cuota_final,
            total_intereses=resultado.total_intereses,
            total_iva=resultado.total_iva,
            total_a_pagar=resultado.total_a_pagar,
            detalle_cuotas=detalle_cuotas
        )
    
    def calcular_resumen(self, parametros: ParametrosCalculo) -> ResumenCalculoResponse:
        """
        Calcula solo el resumen sin detalle de cuotas (más rápido)
        """
        resultado = self.calcular(parametros)
        
        return ResumenCalculoResponse(
            capital=parametros.capital,
            plazo_meses=parametros.plazo_meses,
            tna=parametros.tna,
            sistema=parametros.sistema,
            iva_porcentaje=parametros.iva_porcentaje,
            tem=resultado.tem,
            cuota_inicial=resultado.cuota_inicial,
            cuota_final=resultado.cuota_final,
            total_intereses=resultado.total_intereses,
            total_iva=resultado.total_iva,
            total_a_pagar=resultado.total_a_pagar
        )
    
    def calcular(self, parametros: ParametrosCalculo) -> ResultadoCalculo:
        """
        Método principal que calcula según el sistema especificado
        """
        if parametros.sistema == SistemaCalculo.FRANCES:
            return self.calcular_sistema_frances(parametros)
        elif parametros.sistema == SistemaCalculo.ALEMAN:
            return self.calcular_sistema_aleman(parametros)
        else:
            raise ValueError(f"Sistema de cálculo no soportado: {parametros.sistema}")
    
    def calcular_completo(self, parametros: ParametrosCalculo) -> CalculoResponse:
        """
        Método principal que calcula y devuelve response completo para API
        """
        resultado = self.calcular(parametros)
        
        # Convertir a response model
        detalle_cuotas = [
            DetalleCuotaResponse(**cuota) for cuota in resultado.detalle_cuotas
        ]
        
        return CalculoResponse(
            capital=parametros.capital,
            plazo_meses=parametros.plazo_meses,
            tna=parametros.tna,
            sistema=parametros.sistema,
            iva_porcentaje=parametros.iva_porcentaje,
            tem=resultado.tem,
            cuota_inicial=resultado.cuota_inicial,
            cuota_final=resultado.cuota_final,
            total_intereses=resultado.total_intereses,
            total_iva=resultado.total_iva,
            total_a_pagar=resultado.total_a_pagar,
            detalle_cuotas=detalle_cuotas
        )
    
    def calcular_resumen(self, parametros: ParametrosCalculo) -> ResumenCalculoResponse:
        """
        Calcula solo el resumen sin detalle de cuotas (más rápido)
        """
        resultado = self.calcular(parametros)
        
        return ResumenCalculoResponse(
            capital=parametros.capital,
            plazo_meses=parametros.plazo_meses,
            tna=parametros.tna,
            sistema=parametros.sistema,
            iva_porcentaje=parametros.iva_porcentaje,
            tem=resultado.tem,
            cuota_inicial=resultado.cuota_inicial,
            cuota_final=resultado.cuota_final,
            total_intereses=resultado.total_intereses,
            total_iva=resultado.total_iva,
            total_a_pagar=resultado.total_a_pagar
        )