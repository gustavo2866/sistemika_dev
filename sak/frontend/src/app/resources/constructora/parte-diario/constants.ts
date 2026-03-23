"use client";

export const estadoParteChoices = [
  { id: "pendiente", name: "Pendiente" },
  { id: "cerrado", name: "Cerrado" },
];

export const tipoLicenciaChoices = [
  { id: "enfermedad", name: "Enfermedad" },
  { id: "sin_aviso", name: "Sin aviso" },
  { id: "legal", name: "Legal" },
];

export const getEstadoParteLabel = (value?: string | null) =>
  estadoParteChoices.find((choice) => choice.id === value)?.name ?? "Sin estado";

export const getEstadoParteBadgeClass = (value?: string | null) => {
  if (value === "cerrado") return "bg-emerald-100 text-emerald-700";
  if (value === "pendiente") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};
