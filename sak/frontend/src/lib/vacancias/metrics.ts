import type { Vacancia } from "@/app/resources/propiedades/model";

export type VacanciaKPIs = {
  totalActivas: number;
  totalCerradas: number;
  promedioDiasTotales: number;
  promedioDiasReparacion: number;
  promedioDiasDisponible: number;
  porcentajeRetiradas: number;
};

const avg = (values: number[]) => {
  if (!values.length) return 0;
  return Math.round(
    (values.reduce((acc, current) => acc + current, 0) / values.length) * 10
  ) / 10;
};

const normalizeMetric = (value?: number | string | null) => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
  return parsed;
};

export const preferCalculated = (persisted?: number | string | null, calculated?: number | string | null) => {
  const normalizedCalculated = normalizeMetric(calculated);
  if (normalizedCalculated !== null) return normalizedCalculated;
  const normalizedPersisted = normalizeMetric(persisted);
  if (normalizedPersisted !== null) return normalizedPersisted;
  return null;
};

export const buildVacanciaKPIs = (vacancias: Vacancia[]): VacanciaKPIs => {
  const activas = vacancias.filter((vacancia) => vacancia.ciclo_activo);
  const cerradas = vacancias.filter((vacancia) => !vacancia.ciclo_activo);

  const diasTotales = vacancias
    .map((vacancia) =>
      preferCalculated(vacancia.dias_totales, vacancia.dias_totales_calculado)
    )
    .filter((value): value is number => typeof value === "number");
  const diasReparacion = vacancias
    .map((vacancia) =>
      preferCalculated(vacancia.dias_reparacion, vacancia.dias_reparacion_calculado)
    )
    .filter((value): value is number => typeof value === "number");
  const diasDisponibles = vacancias
    .map((vacancia) =>
      preferCalculated(vacancia.dias_disponible, vacancia.dias_disponible_calculado)
    )
    .filter((value): value is number => typeof value === "number");

  const retiradas = vacancias.filter(
    (vacancia) => Boolean(vacancia.fecha_retirada) && !vacancia.ciclo_activo
  ).length;

  return {
    totalActivas: activas.length,
    totalCerradas: cerradas.length,
    promedioDiasTotales: avg(diasTotales),
    promedioDiasReparacion: avg(diasReparacion),
    promedioDiasDisponible: avg(diasDisponibles),
    porcentajeRetiradas:
      vacancias.length > 0 ? Math.round((retiradas / vacancias.length) * 1000) / 10 : 0,
  };
};
