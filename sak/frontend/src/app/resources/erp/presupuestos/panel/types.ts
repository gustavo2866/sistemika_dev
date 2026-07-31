export type MonthValues = {
  ingresos: number;
  egresos: number;
  real_ingresos: number;
  real_egresos: number;
  empleados: number;
  presupuesto_id?: number | null;
  record_count?: number;
};

export type EditableField = "obreros_cantidad" | "egreso" | "ingres";

export type EditingCell = {
  month: string;
  field: EditableField;
} | null;

export type PresupuestoFilterContext = {
  proyecto_id: number;
  erp_cuenta_id: number;
};

export type PanelCuenta = {
  cuenta_id: number;
  cuenta_codigo?: string | null;
  cuenta_nombre: string;
  months: Record<string, MonthValues>;
};

export type PanelRubro = {
  rubro_id: number;
  rubro_nombre: string;
  months: Record<string, MonthValues>;
  cuentas: PanelCuenta[];
};

export type PanelProject = {
  proyecto_id: number;
  proyecto_nombre: string;
  months: Record<string, MonthValues>;
  rubros: PanelRubro[];
};

export type PanelResponse = {
  fecha_desde: string;
  fecha_hasta: string;
  estado: string;
  months: string[];
  rows: PanelProject[];
};

export type PanelProjectsResponse = {
  estado: string;
  rows: Array<{
    proyecto_id: number;
    proyecto_nombre: string;
  }>;
};

export type MovimientoConcepto = "egreso" | "ingreso" | "resultado";

export type MovimientoContext = {
  proyecto_id: number;
  projectName?: string;
  rubro_id?: number;
  erp_cuenta_id?: number;
  label: string;
};

export type MovimientoRequest = MovimientoContext & {
  month: string;
  concepto: MovimientoConcepto;
  conceptoLabel: string;
};

export type BudgetExportRequest = MovimientoContext & {
  month: string;
};

export type BudgetCopyRequest = MovimientoContext & {
  month: string;
};

export type BudgetCopyConcept = {
  id: number;
  nombre: string;
};

export type BudgetCopyResponse = {
  copied_rows: number;
  deleted_rows: number;
  varied_rows: number;
};

export type BudgetClearRequest = MovimientoContext & {
  month: string;
};

export type BudgetClearResponse = {
  deleted_rows: number;
};

export type BudgetIncomeRequest = MovimientoContext & {
  month: string;
};

export type BudgetIncomeRow = {
  presupuesto_id: number | null;
  cuenta_id: number;
  rubro_nombre: string;
  cuenta_label: string;
  ingreso_presupuesto: number;
  ingreso_real: number;
  egreso_presupuesto: number;
  egreso_real: number;
};

export type BudgetIncomeRubroTotal = {
  rubro_id?: number;
  real_ingreso: number;
};

export type BudgetImportResponse = {
  valid: boolean;
  errors: string[];
  rows_read: number;
  rows_budgeted: number;
  processed: boolean;
  deleted_rows?: number;
};

export type MovimientoRow = {
  id: number;
  fecha?: string | null;
  tipo_asiento?: string | null;
  nro_asiento?: string | null;
  descripcion?: string | null;
  debe: number;
  haber: number;
  cuenta?: string | null;
  cuenta_codigo?: string | null;
  cuenta_descripcion?: string | null;
};

export type MovimientoResponse = {
  periodo: string;
  concepto: MovimientoConcepto;
  rows: MovimientoRow[];
  total_debe: number;
  total_haber: number;
};

export type SyncRangeResponse = {
  periodo_desde: string;
  periodo_hasta: string;
  dry_run: boolean;
  periodos: string[];
  resultados: Array<{
    periodo: string;
    rows_inserted: number;
  }>;
};
