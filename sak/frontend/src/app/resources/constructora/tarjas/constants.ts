"use client";

export const estadoTarjaChoices = [
  { id: "borrador", name: "Borrador" },
  { id: "cerrado", name: "Cerrado" },
];

export const getEstadoTarjaLabel = (value?: string | null) =>
  estadoTarjaChoices.find((choice) => choice.id === value)?.name ?? "Sin estado";

export const getEstadoTarjaBadgeClass = (value?: string | null) => {
  if (value === "cerrado") return "bg-emerald-100 text-emerald-700";
  if (value === "borrador") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};
