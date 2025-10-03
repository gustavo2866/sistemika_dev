export type SolicitudMbDetalleFormValue = {
  id?: number;
  articulo_id?: number | null;
  descripcion?: string;
  unidad_medida?: string | null;
  cantidad?: number | string | null;
};

export type SolicitudMbFormValues = {
  id?: number;
  version?: number;
  tipo?: "normal" | "directa";
  fecha_necesidad?: string;
  comentario?: string | null;
  solicitante_id?: number | string;
  detalles?: SolicitudMbDetalleFormValue[];
};
