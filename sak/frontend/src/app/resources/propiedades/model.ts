import { createEntitySchema, numberField, stringField } from "@/lib/form-detail-schema";

export type Vacancia = {
  id: number;
  propiedad_id: number;
  propiedad?: Propiedad;
  ciclo_activo: boolean;
  fecha_recibida?: string | null;
  comentario_recibida?: string | null;
  fecha_en_reparacion?: string | null;
  comentario_en_reparacion?: string | null;
  fecha_disponible?: string | null;
  comentario_disponible?: string | null;
  fecha_alquilada?: string | null;
  comentario_alquilada?: string | null;
  fecha_retirada?: string | null;
  comentario_retirada?: string | null;
  dias_reparacion?: number | null;
  dias_disponible?: number | null;
  dias_totales?: number | null;
  dias_reparacion_calculado?: number | null;
  dias_disponible_calculado?: number | null;
  dias_totales_calculado?: number | null;
};

type CRMReference = {
  id: number;
  nombre: string;
};

type Moneda = {
  id: number;
  nombre: string;
  codigo: string;
};

export type Propiedad = {
  id: number;
  nombre: string;
  tipo: string;
  propietario: string;
  ambientes?: number | null;
  metros_cuadrados?: number | null;
  valor_alquiler?: number | null;
  expensas?: number | null;
  fecha_ingreso?: string | null;
  vencimiento_contrato?: string | null;
  estado_comentario?: string | null;
  tipo_operacion_id?: number | null;
  tipo_operacion?: CRMReference | null;
  emprendimiento_id?: number | null;
  emprendimiento?: CRMReference | null;
  costo_propiedad?: number | null;
  costo_moneda_id?: number | null;
  costo_moneda?: Moneda | null;
  precio_venta_estimado?: number | null;
  precio_moneda_id?: number | null;
  precio_moneda?: Moneda | null;
  propiedad_status_id?: number | null;
  propiedad_status?: CRMReference | null;
  vacancias?: Vacancia[];
};

export type PropiedadFormValues = {
  nombre: string;
  tipo: string;
  propietario: string;
  ambientes?: number | null;
  metros_cuadrados?: number | null;
  valor_alquiler?: number | null;
  expensas?: number | null;
  fecha_ingreso?: string | null;
  vencimiento_contrato?: string | null;
  estado_comentario?: string | null;
  tipo_operacion_id?: number | null;
  emprendimiento_id?: number | null;
  costo_propiedad?: number | null;
  costo_moneda_id?: number | null;
  precio_venta_estimado?: number | null;
  precio_moneda_id?: number | null;
  propiedad_status_id?: number | null;
};

export const VACANCIA_STATE_STEPS = [
  {
    key: "recibida",
    label: "Recibida",
    dateField: "fecha_recibida",
    commentField: "comentario_recibida",
  },
  {
    key: "en_reparacion",
    label: "En reparacion",
    dateField: "fecha_en_reparacion",
    commentField: "comentario_en_reparacion",
  },
  {
    key: "disponible",
    label: "Disponible",
    dateField: "fecha_disponible",
    commentField: "comentario_disponible",
  },
  {
    key: "realizada",
    label: "Realizada",
    dateField: "fecha_alquilada",
    commentField: "comentario_alquilada",
  },
  {
    key: "retirada",
    label: "Retirada",
    dateField: "fecha_retirada",
    commentField: "comentario_retirada",
  },
] as const;

export const propiedadSchema = createEntitySchema<PropiedadFormValues, Propiedad>({
  fields: {
    nombre: stringField({ required: true, maxLength: 255, defaultValue: "" }),
    tipo: stringField({ required: true, maxLength: 100, defaultValue: "" }),
    propietario: stringField({ required: true, maxLength: 255, defaultValue: "" }),
    ambientes: numberField({ required: false, min: 0 }),
    metros_cuadrados: numberField({ required: false, min: 0 }),
    valor_alquiler: numberField({ required: false, min: 0 }),
    expensas: numberField({ required: false, min: 0 }),
    fecha_ingreso: stringField({ required: false }),
    vencimiento_contrato: stringField({ required: false }),
    estado_comentario: stringField({ required: false, maxLength: 500 }),
    tipo_operacion_id: numberField({ required: false, min: 1 }),
    emprendimiento_id: numberField({ required: false, min: 1 }),
    costo_propiedad: numberField({ required: false, min: 0 }),
    costo_moneda_id: numberField({ required: false, min: 1 }),
    precio_venta_estimado: numberField({ required: false, min: 0 }),
    precio_moneda_id: numberField({ required: false, min: 1 }),
    propiedad_status_id: numberField({ required: false, min: 1 }),
  },
});

export type VacanciaComentarioForm = {
  comentario_recibida?: string | null;
  comentario_en_reparacion?: string | null;
  comentario_disponible?: string | null;
  comentario_alquilada?: string | null;
  comentario_retirada?: string | null;
};

export const vacanciaComentarioSchema = createEntitySchema<VacanciaComentarioForm, Vacancia>({
  fields: {
    comentario_recibida: stringField({ maxLength: 500 }),
    comentario_en_reparacion: stringField({ maxLength: 500 }),
    comentario_disponible: stringField({ maxLength: 500 }),
    comentario_alquilada: stringField({ maxLength: 500 }),
    comentario_retirada: stringField({ maxLength: 500 }),
  },
});

