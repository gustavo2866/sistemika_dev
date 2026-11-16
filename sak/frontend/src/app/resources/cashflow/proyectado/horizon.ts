import { apiUrl } from "@/lib/dataProvider";

export type CashProjectionHorizon = {
  historico_desde: string;
  proyeccion_desde: string;
  proyeccion_hasta: string;
  meses_proyeccion: number;
  ultimo_periodo_cerrado: string | null;
};

export const fetchCashProjectionHorizon = async (): Promise<CashProjectionHorizon> => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${apiUrl}/erp/cash/projection-horizon`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "No se pudo cargar el horizonte de proyección");
  return payload as CashProjectionHorizon;
};
