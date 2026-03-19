import type {
  CRMOportunidad,
  CRMOportunidadEstado,
  BucketKey,
} from "../crm-oportunidades/model";

export const PANEL_BUCKET_PAGE_SIZE = 20;
export const PANEL_BUCKET_SORT = {
  field: "fecha_estado",
  order: "DESC",
} as const;
export const CLOSED_BUCKET_WINDOW_DAYS = 30;

export type PanelBucketKey =
  | "prospect"
  | "en-proceso"
  | "reservadas"
  | "cerradas";

export type PanelChange = {
  oportunidadId: number;
  fromBucket: PanelBucketKey;
  intendedBucket: PanelBucketKey;
};

export const PANEL_BUCKET_ORDER: PanelBucketKey[] = [
  "prospect",
  "en-proceso",
  "reservadas",
  "cerradas",
];

export const PANEL_BUCKET_CONFIG: Record<
  PanelBucketKey,
  {
    label: string;
    accentClass: string;
    states: BucketKey[];
    dropEstado?: BucketKey;
    interactive?: boolean;
  }
> = {
  prospect: {
    label: "Prospect",
    accentClass: "from-slate-50/90 to-slate-100/80",
    states: ["0-prospect"],
    interactive: false,
  },
  "en-proceso": {
    label: "En proceso",
    accentClass: "from-blue-50/90 via-cyan-50/80 to-amber-50/80",
    states: ["1-abierta", "2-visita", "3-cotiza"],
    dropEstado: "1-abierta",
  },
  reservadas: {
    label: "Reservadas",
    accentClass: "from-violet-50/90 to-violet-100/70",
    states: ["4-reserva"],
    dropEstado: "4-reserva",
  },
  cerradas: {
    label: "Cerradas",
    accentClass: "from-emerald-50/70 via-emerald-50/60 to-rose-50/70",
    states: ["5-ganada", "6-perdida"],
    interactive: true,
  },
};

const ESTADO_SORT_ORDER: Record<CRMOportunidadEstado, number> = {
  "0-prospect": 0,
  "1-abierta": 1,
  "2-visita": 2,
  "3-cotiza": 3,
  "4-reserva": 4,
  "5-ganada": 5,
  "6-perdida": 6,
};

export const getPanelBucketLabel = (bucketKey: PanelBucketKey) =>
  PANEL_BUCKET_CONFIG[bucketKey].label;

export const getPanelBucketKey = (
  estado?: CRMOportunidadEstado | null,
): PanelBucketKey => {
  switch (estado) {
    case "0-prospect":
      return "prospect";
    case "1-abierta":
    case "2-visita":
    case "3-cotiza":
      return "en-proceso";
    case "4-reserva":
      return "reservadas";
    case "5-ganada":
    case "6-perdida":
      return "cerradas";
    default:
      return "en-proceso";
  }
};

export const buildPanelChange = (
  oportunidad: CRMOportunidad,
  intendedBucket: PanelBucketKey,
): PanelChange => ({
  oportunidadId: oportunidad.id,
  fromBucket: getPanelBucketKey(oportunidad.estado),
  intendedBucket,
});

export const buildPanelBucketFilter = (
  bucketKey: PanelBucketKey,
  baseFilters: Record<string, unknown>,
) => {
  const config = PANEL_BUCKET_CONFIG[bucketKey];

  return {
    ...baseFilters,
    ...(bucketKey === "cerradas"
      ? { panel_window_days: CLOSED_BUCKET_WINDOW_DAYS }
      : {}),
    ...(config.states.length === 1
      ? { estado: config.states[0] }
      : { estado__in: config.states }),
  };
};

export const sortPanelBucketItems = (items: CRMOportunidad[]) =>
  [...items].sort((left, right) => {
    const stateDiff =
      ESTADO_SORT_ORDER[left.estado] - ESTADO_SORT_ORDER[right.estado];
    if (stateDiff !== 0) {
      return stateDiff;
    }

    const leftTime = new Date(left.fecha_estado ?? left.created_at).getTime();
    const rightTime = new Date(right.fecha_estado ?? right.created_at).getTime();
    return rightTime - leftTime;
  });
