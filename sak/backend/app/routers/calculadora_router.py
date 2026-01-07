"""
Router para la API de calculadora financiera
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.schemas.financiero import CalculoRequest, CalculoResponse, ResumenCalculoResponse, SistemaCalculo
from app.services.calculador_financiero import CalculadorFinanciero, ParametrosCalculo

router = APIRouter(prefix="/api/calculadora", tags=["calculadora-financiera"])

# Instancia global del calculador
calculadora = CalculadorFinanciero()

@router.post("/calcular", response_model=CalculoResponse)
async def calcular_prestamo(request: CalculoRequest):
    """
    Calcula un préstamo completo con detalle de todas las cuotas.
    
    Soporta sistemas Francés (cuotas constantes) y Alemán (cuotas decrecientes).
    
    **Parámetros:**
    - **capital**: Monto del préstamo
    - **cantidad_cuotas**: Número de cuotas (1-600)
    - **tna**: Tasa Nominal Anual en porcentaje
    - **sistema_calculo**: "frances" o "aleman"
    - **iva_porcentaje**: Porcentaje de IVA sobre intereses (default: 10.50%)
    
    **Retorna:**
    - Cálculo completo con detalle de cada cuota
    """
    try:
        parametros = ParametrosCalculo.from_request(request)
        resultado = calculadora.calcular_completo(parametros)
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.post("/calcular/resumen", response_model=ResumenCalculoResponse)
async def calcular_resumen(request: CalculoRequest):
    """
    Calcula un préstamo sin detalle de cuotas (más rápido).
    
    Útil para obtener solo los totales y primera/última cuota.
    """
    try:
        parametros = ParametrosCalculo.from_request(request)
        resultado = calculadora.calcular_resumen(parametros)
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.get("/sistemas", response_model=dict)
async def obtener_sistemas():
    """
    Obtiene los sistemas de cálculo disponibles.
    """
    return {
        "sistemas": [
            {
                "codigo": SistemaCalculo.FRANCES,
                "nombre": "Sistema Francés", 
                "descripcion": "Cuotas constantes, amortización creciente"
            },
            {
                "codigo": SistemaCalculo.ALEMAN,
                "nombre": "Sistema Alemán",
                "descripcion": "Cuotas decrecientes, amortización constante"
            }
        ]
    }

@router.get("/tem", response_model=dict)
async def calcular_tem(tna: float = Query(..., description="Tasa Nominal Anual en %")):
    """
    Calcula la Tasa Efectiva Mensual a partir de una TNA.
    """
    try:
        from decimal import Decimal
        tna_decimal = Decimal(str(tna))
        tem = calculadora.calcular_tem(tna_decimal)
        return {
            "tna": tna,
            "tem": float(tem),
            "formula": "TEM = TNA / 12"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en cálculo: {str(e)}")

@router.get("/ejemplos", response_model=dict)
async def obtener_ejemplos():
    """
    Devuelve ejemplos de cálculos para testing.
    """
    return {
        "ejemplos": [
            {
                "nombre": "Sistema Francés - Ejemplo 1",
                "request": {
                    "capital": 14700000.00,
                    "cantidad_cuotas": 36,
                    "tna": 60.00,
                    "sistema_calculo": "frances",
                    "iva_porcentaje": 10.50
                },
                "descripcion": "Ejemplo basado en planilla Excel - Sistema Francés"
            },
            {
                "nombre": "Sistema Alemán - Ejemplo 1", 
                "request": {
                    "capital": 4000000.00,
                    "cantidad_cuotas": 48,
                    "tna": 21.00,
                    "sistema_calculo": "aleman",
                    "iva_porcentaje": 10.50
                },
                "descripcion": "Ejemplo basado en planilla Excel - Sistema Alemán"
            },
            {
                "nombre": "Comparación Simple",
                "request": {
                    "capital": 1000000.00,
                    "cantidad_cuotas": 12,
                    "tna": 36.00,
                    "sistema_calculo": "frances",
                    "iva_porcentaje": 10.50
                },
                "descripcion": "Ejemplo simple para comparar sistemas"
            }
        ]
    }

@router.get("/health")
async def health_check():
    """
    Endpoint de health check para la calculadora.
    """
    return {"status": "ok", "service": "calculadora-financiera"}