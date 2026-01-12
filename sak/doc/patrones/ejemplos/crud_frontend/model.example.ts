export type Recurso = {
  id?: number;
  nombre: string;
  descripcion?: string | null;
  categoria_id?: number | null;
};

export const VALIDATION_RULES = {
  GENERAL: {
    MAX_DESCRIPCION_LENGTH: 500,
  },
} as const;

export const CATEGORIAS_REFERENCE = {
  resource: "categorias",
  labelField: "nombre",
  limit: 100,
  staleTime: 5 * 60 * 1000,
} as const;
