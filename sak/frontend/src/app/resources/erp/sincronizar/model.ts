export type ProcessStatus = "pending" | "processing" | "completed" | "error";

export type ProcessStepId =
  | "validate"
  | "periodo"
  | "libro-diario"
  | "libro-mayor"
  | "actualizar-icc"
  | "presupuesto"
  | "pendientes"
  | "cash"
  | "complete";

export type ProcessStep = {
  id: ProcessStepId;
  label: string;
  status: ProcessStatus;
  detail?: string;
};

export type PendingFileRow = {
  id: string;
  empresaId: string;
  file: File | null;
  status: ProcessStatus;
  detail?: string;
};

export const INITIAL_PROCESS_STEPS: ProcessStep[] = [
  { id: "validate", label: "Validar períodos y archivos", status: "pending" },
  { id: "periodo", label: "Iniciar cierre del período", status: "pending" },
  { id: "libro-diario", label: "Sincronizar Libro Diario", status: "pending" },
  { id: "libro-mayor", label: "Sincronizar Libro Mayor", status: "pending" },
  { id: "actualizar-icc", label: "Actualizar Libro Mayor por ICC", status: "pending" },
  { id: "presupuesto", label: "Actualizar Presupuesto", status: "pending" },
  { id: "pendientes", label: "Cargar archivos de pendientes", status: "pending" },
  { id: "cash", label: "Actualizar Cash", status: "pending" },
  { id: "complete", label: "Proceso finalizado", status: "pending" },
];

export const createPendingFileRow = (): PendingFileRow => ({
  id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  empresaId: "",
  file: null,
  status: "pending",
});

