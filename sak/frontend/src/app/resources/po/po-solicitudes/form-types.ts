/**
 * Tipos de formulario para PoSolicitudes.
 * Se mantienen fuera del modelo de dominio para separar UI de negocio.
 */

/**
 * Detalle en formato de formulario (valores temporales)
 *
 * NOTA: Los IDs de referencias son strings para compatibilidad con Combobox
 */
export type DetalleFormValues = {
  articulo_id: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio: number;
  importe: number;
};

export type PoSolicitudCabeceraFormValues = {
  titulo: string;
  tipo_solicitud_id: string;
  departamento_id: string;
  centro_costo_id: string;
  estado: string;
  tipo_compra: string;
  fecha_necesidad: string;
  solicitante_id: string;
  comentario: string;
  oportunidad_id: string;
  proveedor_id: string;
};
