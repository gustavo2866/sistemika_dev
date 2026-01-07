"use client";

import { useState, useCallback } from "react";
import { useNotify } from "ra-core";
import type { 
  CalculoRequest, 
  CalculoResponse, 
  ResumenCalculo 
} from "@/types/calculadora";

interface UseCalculadoraState {
  isLoading: boolean;
  error: string | null;
  resultado: CalculoResponse | null;
  resumen: ResumenCalculo | null;
}

interface UseCalculadoraReturn extends UseCalculadoraState {
  calcularCompleto: (request: CalculoRequest) => Promise<void>;
  calcularResumen: (request: CalculoRequest) => Promise<void>;
  limpiar: () => void;
  calcularTEM: (tna: number) => Promise<{ tem: number; formula: string } | null>;
  obtenerSistemas: () => Promise<Array<{ codigo: string; descripcion: string }> | null>;
}

export function useCalculadora(): UseCalculadoraReturn {
  const [state, setState] = useState<UseCalculadoraState>({
    isLoading: false,
    error: null,
    resultado: null,
    resumen: null,
  });

  const notify = useNotify();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const toNumber = (value: unknown): number => {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const normalizeResumen = (resumen: ResumenCalculo): ResumenCalculo => ({
    ...resumen,
    capital: toNumber(resumen.capital),
    plazo_meses: Number(resumen.plazo_meses),
    tna: toNumber(resumen.tna),
    iva_porcentaje: toNumber(resumen.iva_porcentaje),
    tem: toNumber(resumen.tem),
    cuota_inicial: toNumber(resumen.cuota_inicial),
    cuota_final: toNumber(resumen.cuota_final),
    total_intereses: toNumber(resumen.total_intereses),
    total_iva: toNumber(resumen.total_iva),
    total_a_pagar: toNumber(resumen.total_a_pagar),
  });

  const normalizeCompleto = (resultado: CalculoResponse): CalculoResponse => ({
    ...normalizeResumen(resultado),
    detalle_cuotas: resultado.detalle_cuotas.map(detalle => ({
      ...detalle,
      capital_periodo: toNumber(detalle.capital_periodo),
      interes_periodo: toNumber(detalle.interes_periodo),
      cuota_sin_iva: toNumber(detalle.cuota_sin_iva),
      iva_sobre_interes: toNumber(detalle.iva_sobre_interes),
      cuota_con_iva: toNumber(detalle.cuota_con_iva),
      amortizacion_acumulada: toNumber(detalle.amortizacion_acumulada),
      capital_acumulado: toNumber(detalle.capital_acumulado),
      saldo_deuda: toNumber(detalle.saldo_deuda),
    })),
  });

  const handleApiCall = useCallback(async <T>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: CalculoRequest
  ): Promise<T | null> => {
    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        ...(body && { body: JSON.stringify(body) }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setState(prev => ({ ...prev, error: message, isLoading: false }));
      notify(message, { type: "error" });
      return null;
    }
  }, [apiUrl, notify]);

  const calcularCompleto = useCallback(async (request: CalculoRequest) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, resumen: null }));
    
    const resultado = await handleApiCall<CalculoResponse>(
      "/api/calculadora/calcular",
      "POST",
      request
    );

    if (resultado) {
      const normalized = normalizeCompleto(resultado);
      setState(prev => ({ 
        ...prev, 
        resultado: normalized, 
        isLoading: false,
        resumen: null 
      }));
      notify("Cálculo completado exitosamente", { type: "success" });
    }
  }, [handleApiCall, notify]);

  const calcularResumen = useCallback(async (request: CalculoRequest) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, resultado: null }));
    
    const resumen = await handleApiCall<ResumenCalculo>(
      "/api/calculadora/calcular/resumen",
      "POST",
      request
    );

    if (resumen) {
      const normalized = normalizeResumen(resumen);
      setState(prev => ({ 
        ...prev, 
        resumen: normalized, 
        isLoading: false,
        resultado: null 
      }));
      notify("Resumen calculado exitosamente", { type: "success" });
    }
  }, [handleApiCall, notify]);

  const calcularTEM = useCallback(async (tna: number) => {
    return await handleApiCall<{ tem: number; formula: string }>(
      `/api/calculadora/tem?tna=${tna}`
    );
  }, [handleApiCall]);

  const obtenerSistemas = useCallback(async () => {
    return await handleApiCall<Array<{ codigo: string; descripcion: string }>>(
      "/api/calculadora/sistemas"
    );
  }, [handleApiCall]);

  const limpiar = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      resultado: null,
      resumen: null,
    });
  }, []);

  return {
    ...state,
    calcularCompleto,
    calcularResumen,
    calcularTEM,
    obtenerSistemas,
    limpiar,
  };
}
