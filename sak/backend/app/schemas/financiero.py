"""
Modelos Pydantic para la API de calculadora financiera
Solo para request/response, sin persistencia en DB
"""
from pydantic import BaseModel, Field
from decimal import Decimal
from typing import List, Optional
from enum import Enum

class SistemaCalculo(str, Enum):
    """Sistemas de cálculo disponibles"""
    FRANCES = "frances"  # Cuotas constantes
    ALEMAN = "aleman"    # Cuotas decrecientes

class CalculoRequest(BaseModel):
    """Request para calcular un préstamo"""
    capital: Decimal = Field(gt=0, description="Capital inicial del préstamo")
    plazo_meses: int = Field(gt=0, le=600, description="Número total de meses (máximo 600)")
    tna: Decimal = Field(gt=0, le=200, description="Tasa Nominal Anual en % (máximo 200%)")
    sistema: SistemaCalculo = Field(description="Sistema de cálculo")
    iva_porcentaje: Decimal = Field(default=Decimal("10.50"), ge=0, le=50, description="Porcentaje de IVA sobre intereses")
    
    class Config:
        json_schema_extra = {
            "example": {
                "capital": 1000000.00,
                "plazo_meses": 12,
                "tna": 36.00,
                "sistema": "frances",
                "iva_porcentaje": 10.50
            }
        }

class DetalleCuotaResponse(BaseModel):
    """Detalle de una cuota individual"""
    numero_cuota: int
    capital_periodo: Decimal
    interes_periodo: Decimal
    cuota_sin_iva: Decimal
    iva_sobre_interes: Decimal
    cuota_con_iva: Decimal
    amortizacion_acumulada: Decimal
    capital_acumulado: Decimal
    saldo_deuda: Decimal

class CalculoResponse(BaseModel):
    """Response completo del cálculo"""
    # Parámetros de entrada
    capital: Decimal
    plazo_meses: int
    tna: Decimal
    sistema: SistemaCalculo
    iva_porcentaje: Decimal
    
    # Resultados calculados
    tem: Decimal = Field(description="Tasa Efectiva Mensual en %")
    cuota_inicial: Decimal = Field(description="Primera cuota sin IVA")
    cuota_final: Decimal = Field(description="Última cuota sin IVA")
    total_intereses: Decimal = Field(description="Total de intereses a pagar")
    total_iva: Decimal = Field(description="Total de IVA a pagar")
    total_a_pagar: Decimal = Field(description="Total a pagar (capital + intereses + IVA)")
    
    # Detalle de cuotas
    detalle_cuotas: List[DetalleCuotaResponse]
    
    class Config:
        json_schema_extra = {
            "example": {
                "capital": 1000000.00,
                "plazo_meses": 12,
                "tna": 36.00,
                "sistema": "frances",
                "iva_porcentaje": 10.50,
                "tem": 3.00,
                "cuota_inicial": 100000.00,
                "cuota_final": 100000.00,
                "total_intereses": 200000.00,
                "total_iva": 21000.00,
                "total_a_pagar": 1221000.00,
                "detalle_cuotas": []
            }
        }

class ResumenCalculoResponse(BaseModel):
    """Response resumido sin detalle de cuotas (para cálculos rápidos)"""
    # Parámetros de entrada
    capital: Decimal
    plazo_meses: int
    tna: Decimal
    sistema: SistemaCalculo
    iva_porcentaje: Decimal
    
    # Resultados calculados
    tem: Decimal
    cuota_inicial: Decimal
    cuota_final: Decimal
    total_intereses: Decimal
    total_iva: Decimal
    total_a_pagar: Decimal