"use client";

export const estadoParteChoices = [
  { id: "borrador", name: "Borrador" },
  { id: "confirmado", name: "Confirmado" },
  { id: "cerrado", name: "Cerrado" },
];

export const getEstadoParteLabel = (value?: string | null) =>
  estadoParteChoices.find((choice) => choice.id === value)?.name ?? "Sin estado";

export const getEstadoParteBadgeClass = (value?: string | null) => {
  if (value === "confirmado") return "bg-emerald-100 text-emerald-700";
  if (value === "cerrado") return "bg-blue-100 text-blue-700";
  if (value === "borrador") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};
