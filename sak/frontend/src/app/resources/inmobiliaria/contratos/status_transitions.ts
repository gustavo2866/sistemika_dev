export type ContratoEstadoKey =
  | "borrador"
  | "vigente"
  | "rescindido"
  | "finalizado";

export const canContratoActivar = (estado?: string | null): boolean =>
  estado === "borrador";

export const canContratoRescindir = (estado?: string | null): boolean =>
  estado === "vigente";

export const canContratoFinalizar = (estado?: string | null): boolean =>
  estado === "vigente";
