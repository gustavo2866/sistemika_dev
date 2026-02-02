/**
 * Hooks y utilidades del formulario de PoSolicitudes.
 *
 * Estructura:
 * 1. TIPOS - Tipos auxiliares y contratos internos
 * 2. CATALOGOS - Carga de catalogos y referencias
 * 3. DEFAULTS Y SINCRONIZACION - Defaults, visibilidad y contexto de oportunidad
 * 4. LOOKUPS - Consultas por id para referencias
 * 5. WIZARD - Helpers para aplicar payloads y defaults del wizard
 * 6. EMISION - Emision y cambio de estado de la solicitud
 */

"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useDataProvider,
  useGetOne,
  useRecordContext,
  useRedirect,
  useResourceContext,
  useSaveContext,
} from "ra-core";
import {
  useFormContext,
  useFormState,
  useWatch,
  type UseFormReturn,
  type UseFormSetValue,
} from "react-hook-form";
import type { TipoSolicitud } from "../../tipos-solicitud/model";
import { formatOportunidadLabel } from "../../crm-oportunidades/OportunidadSelector";
import {
  TIPOS_SOLICITUD_REFERENCE,
  calculateImporte,
  calculateTotal,
  buildPoSolicitudCabeceraSubtitle,
  buildPoSolicitudImputacionSubtitle,
  getDepartamentoDefaultByTipo,
  type PoSolicitud,
  type PoSolicitudDetalle,
  type WizardPayload,
  OPORTUNIDADES_REFERENCE,
} from "./model";
import {
  useReferenceFieldWatcher,
  useCentroCostoWatcher,
} from "@/components/generic";
import { getOportunidadIdFromLocation } from "@/lib/oportunidad-context";
import { useLocation } from "react-router-dom";

//******************************* */
// region 1. TIPOS

// Define SetValueFn para uso en hooks de default del wizard.
type SetValueFn = (
  name:
    | "titulo"
    | "descripcion"
    | "cantidad"
    | "precio"
    | "proveedorId"
    | "fechaNecesidad"
    | "solicitanteId"
    | "oportunidadId"
    | "tipoSolicitudId"
    | "departamentoId"
    | "tipoCompra"
    | "articuloId",
  value: string | number,
  options?: { shouldDirty?: boolean }
) => void;

// Define TipoSolicitudCatalog para carga de catalogos.
export type TipoSolicitudCatalog = Pick<
  TipoSolicitud,
  "id" | "tipo_articulo_filter_id" | "departamento_default_id"
>;
// endregion

//******************************* */
// region 2. CATALOGOS
// Carga el catalogo de tipos de solicitud para defaults y filtros.

// Usa react-query para cache y performance.
export const useTipoSolicitudCatalog = () => {
  const dataProvider = useDataProvider();
  const { data: tiposSolicitudData } = useQuery<TipoSolicitudCatalog[]>({
    queryKey: ["tipos-solicitud", "defaults"],
    queryFn: async () => {
      const { data } = await dataProvider.getList(
        TIPOS_SOLICITUD_REFERENCE.resource,
        {
          pagination: { page: 1, perPage: TIPOS_SOLICITUD_REFERENCE.limit },
          sort: { field: "nombre", order: "ASC" },
          filter: {},
          meta: {
            __expanded_list_relations__: ["tipo_articulo_filter_rel"],
          },
        }
      );
      return data as TipoSolicitudCatalog[];
    },
    staleTime: TIPOS_SOLICITUD_REFERENCE.staleTime,
  });

  return {
    tiposSolicitudData: tiposSolicitudData ?? [],
    tiposSolicitudCatalog: tiposSolicitudData ?? [],
  };
};

// Construye subtitulos para secciones del formulario (cabecera e imputacion).
export const usePoSolicitudSectionSubtitles = () => {
  const { data: centroCostoData } = useCentroCostoWatcher("centro_costo_id");
  const { data: oportunidadData } = useReferenceFieldWatcher(
    "oportunidad_id",
    OPORTUNIDADES_REFERENCE.resource,
    { validation: (value) => !!value && typeof value === "object" }
  );
  const { tiposSolicitudCatalog } = useTipoSolicitudCatalog();
  const { control } = useFormContext<PoSolicitud>();
  const tituloValue = useWatch({ control, name: "titulo" });
  const tipoSolicitudValue = useWatch({ control, name: "tipo_solicitud_id" });
  const oportunidadValue = useWatch({ control, name: "oportunidad_id" });

  const tipoSolicitudNombre = useMemo(() => {
    if (!tipoSolicitudValue || !tiposSolicitudCatalog) return undefined;
    const match = tiposSolicitudCatalog.find(
      (item) => item.id === Number(tipoSolicitudValue)
    );
    return match ? String((match as { nombre?: string }).nombre ?? "") : undefined;
  }, [tipoSolicitudValue, tiposSolicitudCatalog]);

  const cabeceraSubtitle = useMemo(
    () =>
      buildPoSolicitudCabeceraSubtitle({
        titulo: tituloValue ? String(tituloValue) : undefined,
        tipoSolicitudNombre,
      }),
    [tipoSolicitudNombre, tituloValue]
  );

  const oportunidadLabel = useMemo(() => {
    if (oportunidadData && typeof oportunidadData === "object") {
      return formatOportunidadLabel(oportunidadData);
    }
    if (typeof oportunidadValue === "object" && oportunidadValue) {
      return formatOportunidadLabel(oportunidadValue);
    }
    return undefined;
  }, [oportunidadData, oportunidadValue]);

  const imputacionSubtitle = useMemo(
    () =>
      buildPoSolicitudImputacionSubtitle({
        oportunidadTitulo: oportunidadLabel,
        centroCostoNombre: (centroCostoData as { nombre?: string } | undefined)
          ?.nombre,
      }),
    [centroCostoData, oportunidadLabel]
  );

 return {
    cabeceraSubtitle,
    imputacionSubtitle,
    tiposSolicitudCatalog,
  };
};

export const PoSolicitudSectionSubtitle = ({ text }: { text: string }) =>
  createElement("div", {
    className: "text-[10px] leading-none text-muted-foreground sm:text-xs",
    children: text,
  });
// endregion

//******************************* */
// region 3.1. VISIBILIDAD SECCIONES
// Controla la visibilidad de Imputacion en base al estado de Detalle.
export const useImputacionVisibilityByDetalle = () => {
  const [showImputacion, setShowImputacion] = useState(true);

  const handleDetalleOpen = () => {
    setShowImputacion(false);
  };

  const handleDetalleClose = () => {
    setShowImputacion(true);
  };

  return {
    showImputacion,
    handleDetalleOpen,
    handleDetalleClose,
  };
};
// endregion

//******************************* */
// region 3.2. CONTEXTO OPORTUNIDAD
// Define oportunidad default usando el contexto de la URL.
export const useDefaultOportunidadFromLocation = ({
  setValue,
  oportunidadIdValue,
}: {
  setValue: SetValueFn;
  oportunidadIdValue?: string | null;
}) => {
  const location = useLocation();
  const oportunidadIdFromLocation = useMemo(
    () => getOportunidadIdFromLocation(location),
    [location]
  );

  useEffect(() => {
    if (!oportunidadIdFromLocation) return;
    if (oportunidadIdValue) return;
    setValue("oportunidadId", String(oportunidadIdFromLocation), {
      shouldDirty: false,
    });
  }, [oportunidadIdFromLocation, oportunidadIdValue, setValue]);

  return { oportunidadIdFromLocation };
};
// endregion

//******************************* */
// region 3. DEFAULTS Y SINCRONIZACION
// Indica si el tipo de solicitud debe bloquearse segun detalles.
export const useTipoSolicitudBloqueado = (detallesValue: unknown) => {
  return useMemo(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    return detalles.length > 0;
  }, [detallesValue]);
};

// Aplica el departamento default cuando cambia el tipo de solicitud.
export const useDepartamentoDefaultByTipo = ({
  form,
  idValue,
  tipoSolicitudValue,
  tiposSolicitudCatalog,
}: {
  form: UseFormReturn<PoSolicitud>;
  idValue: unknown;
  tipoSolicitudValue: unknown;
  tiposSolicitudCatalog: TipoSolicitudCatalog[];
}) => {
  const tipoSolicitudPreviousRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentTipo = tipoSolicitudValue
      ? String(tipoSolicitudValue)
      : undefined;

    if (!currentTipo || tiposSolicitudCatalog.length === 0) {
      tipoSolicitudPreviousRef.current = currentTipo;
      return;
    }

    const defaultDepartamento = getDepartamentoDefaultByTipo(
      currentTipo,
      tiposSolicitudCatalog
    );
    const previousTipo = tipoSolicitudPreviousRef.current;
    const isCreate = !idValue;
    const tipoChanged = Boolean(previousTipo) && previousTipo !== currentTipo;

    if (defaultDepartamento && (isCreate || tipoChanged)) {
      const currentDepartamento = form.getValues("departamento_id");
      const normalizedDepartamento = currentDepartamento?.toString();
      const departamentoDirty = Boolean(
        form.formState.dirtyFields?.departamento_id
      );
      if (!departamentoDirty && normalizedDepartamento !== defaultDepartamento) {
        const departamentoIdValue = Number(defaultDepartamento);
        if (!Number.isNaN(departamentoIdValue)) {
          form.setValue("departamento_id", departamentoIdValue, {
            shouldDirty: true,
          });
        }
      }
    }

    tipoSolicitudPreviousRef.current = currentTipo;
  }, [form, idValue, tipoSolicitudValue, tiposSolicitudCatalog]);
};

// Aplica defaults del proveedor al formulario si no hay valores editados.
export const useProveedorDefaults = ({
  form,
  proveedorId,
}: {
  form: UseFormReturn<PoSolicitud>;
  proveedorId?: number;
}) => {
  const { data: proveedorDefaults } = useGetOne(
    "proveedores",
    { id: proveedorId ?? 0 },
    { enabled: Boolean(proveedorId) }
  );

  useEffect(() => {
    if (!proveedorId || !proveedorDefaults) {
      return;
    }

    const isEmptyValue = (value: unknown) =>
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "");

    const tipoSolicitudDefault = (proveedorDefaults as any)
      ?.default_tipo_solicitud_id;
    const tipoSolicitudDirty = Boolean(
      form.formState.dirtyFields?.tipo_solicitud_id
    );
    if (
      tipoSolicitudDefault &&
      (isEmptyValue(form.getValues("tipo_solicitud_id")) || !tipoSolicitudDirty)
    ) {
      form.setValue("tipo_solicitud_id", Number(tipoSolicitudDefault), {
        shouldDirty: true,
      });
    }

    const departamentoDefault = (proveedorDefaults as any)
      ?.default_departamento_id;
    const departamentoDirty = Boolean(
      form.formState.dirtyFields?.departamento_id
    );
    if (
      departamentoDefault &&
      (isEmptyValue(form.getValues("departamento_id")) || !departamentoDirty)
    ) {
      form.setValue("departamento_id", Number(departamentoDefault), {
        shouldDirty: true,
      });
    }
  }, [form, proveedorDefaults, proveedorId]);

  return proveedorDefaults;
};

// Sincroniza el total del formulario a partir de los detalles.
export const useSyncTotalFromDetalles = ({
  form,
  detallesValue,
}: {
  form: UseFormReturn<PoSolicitud>;
  detallesValue: unknown;
}) => {
  useEffect(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    const calculated = calculateTotal(detalles as PoSolicitud["detalles"]);
    const currentTotal = Number(form.getValues("total") ?? 0);

    if (
      !Number.isNaN(calculated) &&
      Number(currentTotal.toFixed(2)) !== calculated
    ) {
      form.setValue("total", calculated, {
        shouldDirty: true,
      });
    }
  }, [detallesValue, form]);
};
// endregion

//******************************* */
// region 4. LOOKUPS
// Obtiene proveedor por id.
export const useProveedorById = (proveedorId: number | null) =>
  useGetOne(
    "proveedores",
    { id: proveedorId ?? 0 },
    { enabled: proveedorId != null }
  );

// Obtiene usuario por id.
export const useUserById = (userId: number | null) =>
  useGetOne("users", { id: userId ?? 0 }, { enabled: userId != null });

// Obtiene departamento por id.
export const useDepartamentoById = (departamentoId: number | null) =>
  useGetOne(
    "departamentos",
    { id: departamentoId ?? 0 },
    { enabled: departamentoId != null }
  );

// Obtiene articulo por id.
export const useArticuloById = (articuloId: number | null) =>
  useGetOne(
    "articulos",
    { id: articuloId ?? 0 },
    { enabled: articuloId != null }
  );
// endregion

//******************************* */
// region 5. WIZARD
type ApplyWizardPayloadArgs = {
  isCreate: boolean;
  setValue: UseFormSetValue<PoSolicitud>;
  identityId?: number | null;
  payload: WizardPayload;
};

// Construye un detalle desde el payload del wizard.
const buildDetalleFromWizard = (
  payload: WizardPayload
): PoSolicitudDetalle | null => {
  if (payload.articuloId == null) return null;
  const cantidad = payload.cantidad ?? 0;
  const precio = payload.precio ?? 0;
  const importe = calculateImporte(cantidad, precio);

  return {
    id: 0,  // Para nuevos detalles, será asignado por el backend
    tempId: Date.now(),  // ID temporal único para el frontend
    solicitud_id: 0,  // Será asignado cuando se guarde la solicitud
    articulo_id: payload.articuloId,
    descripcion: payload.descripcion ?? "",
    unidad_medida: payload.unidadMedida ?? "UN",
    cantidad,
    precio,
    importe,
  };
};

// Aplica el payload del wizard al formulario principal.
export const applyWizardPayload = ({
  isCreate,
  setValue,
  identityId,
  payload,
}: ApplyWizardPayloadArgs) => {
  if (!isCreate) return;

  if (payload.proveedorId != null) {
    setValue("proveedor_id", payload.proveedorId, { shouldDirty: true });
  }
  if (payload.tipoSolicitudId != null) {
    setValue("tipo_solicitud_id", payload.tipoSolicitudId, { shouldDirty: true });
  }
  if (payload.departamentoId != null) {
    setValue("departamento_id", payload.departamentoId, { shouldDirty: true });
  }
  if (payload.centroCostoId != null) {
    setValue("centro_costo_id", payload.centroCostoId, { shouldDirty: true });
  }
  if (payload.tipoCompra != null) {
    setValue("tipo_compra", payload.tipoCompra, { shouldDirty: true });
  }
  if (payload.titulo !== undefined) {
    setValue("titulo", payload.titulo, { shouldDirty: true });
  }
  if (payload.fechaNecesidad) {
    setValue("fecha_necesidad", payload.fechaNecesidad, { shouldDirty: true });
  }
  if (payload.oportunidadId != null) {
    setValue("oportunidad_id", payload.oportunidadId, { shouldDirty: true });
  }
  if (identityId != null) {
    setValue("solicitante_id", Number(identityId), { shouldDirty: true });
  }

  const detalle = buildDetalleFromWizard(payload);
  if (detalle) {
    setValue("detalles", [detalle], { shouldDirty: true });
  }
};

// Define solicitante por default desde la identidad del usuario.
export const useDefaultSolicitanteFromIdentity = ({
  identityId,
  solicitanteIdValue,
  setValue,
}: {
  identityId: number | null;
  solicitanteIdValue?: string | null;
  setValue: SetValueFn;
}) => {
  useEffect(() => {
    if (!identityId) return;
    if (solicitanteIdValue) return;
    setValue("solicitanteId", String(identityId), { shouldDirty: false });
  }, [identityId, solicitanteIdValue, setValue]);
};

// Define departamento por default a partir del solicitante.
export const useDefaultDepartamentoFromSolicitante = ({
  departamentoIdValue,
  solicitanteDepartamentoIdValue,
  setValue,
}: {
  departamentoIdValue?: string | null;
  solicitanteDepartamentoIdValue?: number | null;
  setValue: SetValueFn;
}) => {
  useEffect(() => {
    if (departamentoIdValue) return;
    if (solicitanteDepartamentoIdValue == null) return;
    setValue("departamentoId", String(solicitanteDepartamentoIdValue), {
      shouldDirty: true,
    });
  }, [departamentoIdValue, setValue, solicitanteDepartamentoIdValue]);
};

// Define articulo por default a partir del proveedor.
export const useDefaultArticuloFromProveedor = ({
  proveedorData,
  articuloIdValue,
  setValue,
}: {
  proveedorData?: unknown;
  articuloIdValue?: string | null;
  setValue: SetValueFn;
}) => {
  useEffect(() => {
    const defaultArticuloId = Number(
      (proveedorData as { default_articulos_id?: number | null } | undefined)
        ?.default_articulos_id ?? 0
    );
    if (!Number.isFinite(defaultArticuloId) || defaultArticuloId <= 0) {
      return;
    }
    if (articuloIdValue) {
      return;
    }
    setValue("articuloId", String(defaultArticuloId), { shouldDirty: true });
  }, [articuloIdValue, proveedorData, setValue]);
};

// endregion

//******************************* */
// region 6. EMISION

// Orquesta la emision de la solicitud con guardado previo si hace falta.
export const usePoSolicitudEmit = ({ onClose }: { onClose: () => void }) => {
  const record = useRecordContext<PoSolicitud>();
  const resource = useResourceContext();
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const saveContext = useSaveContext();
  const form = useFormContext<PoSolicitud>();
  const { dirtyFields } = useFormState();
  const [loading, setLoading] = useState(false);

  const isDirty = Object.keys(dirtyFields).length > 0;
  const canEmit = record?.estado === "borrador" || record?.estado === "emitida";

  const emit = async (openShow: boolean) => {
    if (!record?.id || !resource) return;
    setLoading(true);
    try {
      if (isDirty && saveContext?.save) {
        const errors = await saveContext.save(form.getValues());
        if (errors) {
          return;
        }
      }
      await dataProvider.update(resource, {
        id: record.id,
        data: { estado: "emitida" },
        previousData: record,
      });
      if (openShow) {
        redirect("show", resource, record.id);
        return;
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return {
    canEmit,
    emit,
    loading,
  };
};
// endregion

// Define precio por default desde el articulo si no hay valor.
export const useDefaultPrecioFromArticulo = ({
  articuloData,
  precioValue,
  setValue,
}: {
  articuloData?: unknown;
  precioValue?: unknown;
  setValue: SetValueFn;
}) => {
  useEffect(() => {
    const precioActual = Number(precioValue ?? 0);
    if (Number.isFinite(precioActual) && precioActual > 0) {
      return;
    }
    const precioArticulo = Number(
      (articuloData as { precio?: number | string | null } | undefined)?.precio
    );
    if (!Number.isFinite(precioArticulo) || precioArticulo <= 0) {
      return;
    }
    setValue("precio", precioArticulo, { shouldDirty: true });
  }, [articuloData, precioValue, setValue]);
};
// endregion
