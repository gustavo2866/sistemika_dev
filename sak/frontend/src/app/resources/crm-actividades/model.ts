"use client";

export type Actividad = {
  tipo: "mensaje" | "evento";
  id: number;
  fecha: string;
  descripcion?: string | null;
  canal?: string | null;
  estado?: string | null;
  tipo_mensaje?: string | null;
};

export type ActividadesResponse = {
  mensaje_id?: number;
  oportunidad_id?: number;
  total?: number;
  actividades?: Actividad[];
};
