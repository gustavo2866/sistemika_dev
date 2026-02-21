export const PROPIEDAD_STATUS_IDS = {
  recibida: 1,
  enReparacion: 2,
  disponible: 3,
  realizada: 4,
  retirada: 5,
} as const;

export type PropiedadStatusId =
  (typeof PROPIEDAD_STATUS_IDS)[keyof typeof PROPIEDAD_STATUS_IDS];

export const PROPIEDAD_STATUS_LABELS: Record<PropiedadStatusId, string> = {
  [PROPIEDAD_STATUS_IDS.recibida]: "Recibida",
  [PROPIEDAD_STATUS_IDS.enReparacion]: "En Reparacion",
  [PROPIEDAD_STATUS_IDS.disponible]: "Disponible",
  [PROPIEDAD_STATUS_IDS.realizada]: "Realizada",
  [PROPIEDAD_STATUS_IDS.retirada]: "Retirada",
};

export const PROPIEDAD_STATUS_OPTIONS: Array<{
  id: PropiedadStatusId;
  label: string;
  key: string;
}> = [
  { id: PROPIEDAD_STATUS_IDS.recibida, label: "Recibir", key: "recibir" },
  { id: PROPIEDAD_STATUS_IDS.enReparacion, label: "Reparar", key: "reparar" },
  { id: PROPIEDAD_STATUS_IDS.disponible, label: "Disponible", key: "disponible" },
  { id: PROPIEDAD_STATUS_IDS.realizada, label: "Realizar", key: "realizar" },
  { id: PROPIEDAD_STATUS_IDS.retirada, label: "Retirar", key: "retirar" },
];

export const getPropiedadStatusLabel = (statusId?: number | null) => {
  if (!statusId) return "Sin estado";
  return PROPIEDAD_STATUS_LABELS[statusId as PropiedadStatusId] ?? `Estado #${statusId}`;
};

export const canPropiedadStatusTransition = (
  fromId?: number | null,
  toId?: number | null,
) => {
  if (!fromId || !toId) return false;
  if (fromId === toId) return false;

  const { recibida, enReparacion, disponible, realizada, retirada } =
    PROPIEDAD_STATUS_IDS;

  if (fromId === recibida) {
    return toId !== recibida;
  }
  if (fromId === enReparacion) {
    return toId !== recibida && toId !== enReparacion;
  }
  if (fromId === disponible) {
    return toId !== disponible;
  }
  if (fromId === realizada) {
    return toId === retirada || toId === recibida;
  }
  if (fromId === retirada) {
    return toId === recibida;
  }

  return false;
};

export const getAllowedPropiedadStatusTargets = (fromId?: number | null) => {
  if (!fromId) return [];
  return PROPIEDAD_STATUS_OPTIONS.filter((option) =>
    canPropiedadStatusTransition(fromId, option.id),
  );
};
