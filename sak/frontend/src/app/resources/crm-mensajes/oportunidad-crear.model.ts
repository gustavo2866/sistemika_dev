export type CatalogOption = {
  id: number;
  label: string;
};

export type OportunidadCrearFormValues = {
  contactoNombre: string;
  tipoOperacionId: number | null;
  emprendimientoId: number | null;
  responsableId: number | null;
  nombreOportunidad: string;
  descripcion: string;
};

export const OPORTUNIDAD_CREAR_DEFAULTS: OportunidadCrearFormValues = {
  contactoNombre: "",
  tipoOperacionId: null,
  emprendimientoId: null,
  responsableId: null,
  nombreOportunidad: "",
  descripcion: "",
};

export const toCatalogOptions = (
  records: Array<Record<string, any>> | undefined,
  fallbackPrefix: string,
): CatalogOption[] =>
  records
    ?.filter((record) => record?.id != null)
    .map((record) => ({
      id: record.id,
      label:
        record.nombre ??
        record.descripcion ??
        record.email ??
        `${fallbackPrefix} #${record.id}`,
    })) ?? [];
