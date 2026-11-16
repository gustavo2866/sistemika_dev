export type AnnualValues = {
  historico: number;
  actual: number;
};

export type RealAccount = {
  cuenta_id: number;
  cuenta_codigo?: string | null;
  cuenta_numero?: number | string | null;
  cuenta_nombre: string;
  saldo_inicial: AnnualValues;
  years: Record<string, AnnualValues>;
  total: AnnualValues;
};

export type RealCategory = {
  rubro_id: number;
  rubro_nombre: string;
  saldo_inicial: AnnualValues;
  years: Record<string, AnnualValues>;
  total: AnnualValues;
  cuentas: RealAccount[];
};

export type RealProject = {
  proyecto_id: number;
  proyecto_nombre: string;
  saldo_inicial: AnnualValues;
  years: Record<string, AnnualValues>;
  total: AnnualValues;
  rubros: RealCategory[];
};

export type RealesPanelResponse = {
  anio_desde: number;
  anio_hasta: number;
  estado: string;
  years: number[];
  rows: RealProject[];
};

export type ProjectOption = {
  proyecto_id: number;
  proyecto_nombre: string;
};

export type ProjectOptionsResponse = {
  rows: ProjectOption[];
};
