export type ContratoEstadoKey =
  | "borrador"
  | "vigente"
  | "vencido"
  | "rescindido"
  | "renovado";

// States that allow the Activar transition
const ACTIVAR_ALLOWED: ContratoEstadoKey[] = ["borrador"];
// States that allow the Rescindir transition
const RESCINDIR_ALLOWED: ContratoEstadoKey[] = ["vigente"];
// States that allow the Renovar transition
const RENOVAR_ALLOWED: ContratoEstadoKey[] = ["vigente", "vencido"];

export const canContratoActivar = (estado?: string | null): boolean =>
  ACTIVAR_ALLOWED.includes((estado ?? "") as ContratoEstadoKey);

export const canContratoRescindir = (estado?: string | null): boolean =>
  RESCINDIR_ALLOWED.includes((estado ?? "") as ContratoEstadoKey);

export const canContratoRenovar = (estado?: string | null): boolean =>
  RENOVAR_ALLOWED.includes((estado ?? "") as ContratoEstadoKey);
