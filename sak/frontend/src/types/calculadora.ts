export interface CalculoRequest {
  capital: number;
  plazo_meses: number;
  tna: number;
  sistema: "frances" | "aleman";
  iva_porcentaje?: number;
}

export interface DetalleCuota {
  numero_cuota: number;
  capital_periodo: number;
  interes_periodo: number;
  cuota_sin_iva: number;
  iva_sobre_interes: number;
  cuota_con_iva: number;
  amortizacion_acumulada: number;
  capital_acumulado: number;
  saldo_deuda: number;
}

export interface ResumenCalculo {
  capital: number;
  plazo_meses: number;
  tna: number;
  sistema: "frances" | "aleman";
  iva_porcentaje: number;
  tem: number;
  cuota_inicial: number;
  cuota_final: number;
  total_intereses: number;
  total_iva: number;
  total_a_pagar: number;
}

export interface CalculoResponse extends ResumenCalculo {
  detalle_cuotas: DetalleCuota[];
}

export enum SistemaCalculo {
  FRANCES = "frances",
  ALEMAN = "aleman",
}

export const sistemasCalculoOptions = [
  { value: SistemaCalculo.FRANCES, label: "Sistema Francés (Cuotas constantes)" },
  { value: SistemaCalculo.ALEMAN, label: "Sistema Alemán (Cuotas decrecientes)" },
] as const;