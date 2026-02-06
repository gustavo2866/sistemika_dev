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
import { formatOportunidadLabel } from "../../crm-oportunidades/OportunidadSelector";
import {
  calculateImporte,
  getDepartamentoDefaultByTipo,
  normalizeId,
  normalizeNumber,
  normalizeOptionalNumber,
  type PoSolicitud,
  type PoSolicitudDetalle,
  type WizardPayload,
  OPORTUNIDADES_REFERENCE,
} from "./model";
import {
  buildPoSolicitudCabeceraSubtitle,
  buildPoSolicitudImputacionSubtitle,
  resolveCentroCostoId,
  resolveTipoCompra,
} from "./transformers";
import {
  useReferenceFieldWatcher,
  useCentroCostoWatcher,
} from "@/components/generic";
import { getOportunidadIdFromLocation } from "@/lib/oportunidad-context";
import { useLocation } from "react-router-dom";
import {
  useArticuloPrecioDefault,
  useTipoSolicitudCatalog,
  type TipoSolicitudCatalog,
} from "../shared/po-hooks";


//******************************* */
// region 1. TIPOS                */
//#region 

// 1.1. SetValueFn - Tipo para setValue del formulario de PoSolicitud
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

//#endregion

//******************************* */
// region 2. CATALOGOS
//#region 

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
  createElement(
    "div",
    { className: "text-[10px] leading-none text-muted-foreground sm:text-xs" },
    text
  );
//#endregion

//******************************* */
// region 3. VISIBILIDAD SECCIONES
//#region 

// Controla la visibilidad de Imputacion en base al estado de Detalle.
export const useImputacionVisibilityByDetalle = () => {
  const [showImputacion, setShowImputacion] = useState(true);
  const [imputacionOpen, setImputacionOpen] = useState(false);

  const handleDetalleOpen = () => {
    setShowImputacion(false);
  };

  const handleDetalleClose = () => {
    setShowImputacion(true);
    setImputacionOpen(false);
  };

  const handleImputacionToggle = (nextOpen: boolean) => {
    setShowImputacion(true);
    setImputacionOpen(nextOpen);
  };

  return {
    showImputacion,
    imputacionOpen,
    handleDetalleOpen,
    handleDetalleClose,
    handleImputacionToggle,
  };
};
//#endregion

//******************************* */
// region 4. CONTEXTO OPORTUNIDAD
//#region 

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
//#endregion

//******************************* */
// region 5. DEFAULTS Y SINCRONIZACION
//#region

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

//#endregion

//******************************* */
// region 6. WIZARD
//#region 

// Construye el payload del wizard desde los valores del formulario del wizard.
type ApplyWizardPayloadArgs = {
  isCreate: boolean;
  setValue: UseFormSetValue<PoSolicitud>;
  identityId?: number | null;
  payload: WizardPayload;
};

// Valores necesarios para construir el payload del wizard.
type WizardPayloadBuildValues = {
  titulo: string;
  fechaNecesidad: string;
  proveedorId: string;
  solicitanteId: string;
  oportunidadId: string;
  tipoSolicitudId: string;
  departamentoId: string;
  tipoCompra: string;
  articuloId: string;
  cantidad: number;
  precio: number;
  descripcion: string;
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

// Construye el payload completo del wizard desde los valores del formulario del wizard.
export const buildWizardPayload = ({
  values,
  proveedorId,
  solicitanteDepartamentoIdValue,
  departamentoData,
  solicitanteData,
  unidadMedida,
}: {
  values: WizardPayloadBuildValues;
  proveedorId: number | null;
  solicitanteDepartamentoIdValue: number | null;
  departamentoData: { nombre?: string; centro_costo_id?: number | null } | null;
  solicitanteData: { centro_costo_id?: number | null } | null;
  unidadMedida: string;
}): WizardPayload => {
  const normalizedProveedorId = proveedorId ?? normalizeId(values.proveedorId);
  const normalizedTipoSolicitudId = normalizeId(values.tipoSolicitudId);
  const normalizedDepartamentoId = normalizeId(values.departamentoId);
  const normalizedArticuloId = normalizeId(values.articuloId);
  const normalizedOportunidadId = normalizeId(values.oportunidadId);
  const resolvedDepartamentoId =
    normalizedDepartamentoId ??
    (solicitanteDepartamentoIdValue != null
      ? Number(solicitanteDepartamentoIdValue)
      : null);
  const resolvedCentroCostoId =
    normalizedOportunidadId != null
      ? null
      : resolveCentroCostoId({
          oportunidadId: values.oportunidadId ?? null,
          departamentoNombre: departamentoData?.nombre ?? null,
          departamentoCentroCostoId: departamentoData?.centro_costo_id ?? null,
          solicitanteCentroCostoId: solicitanteData?.centro_costo_id ?? null,
        });
  const resolvedFecha =
    values.fechaNecesidad && String(values.fechaNecesidad).trim().length > 0
      ? values.fechaNecesidad
      : null;
  const resolvedCantidad = normalizedArticuloId
    ? normalizeOptionalNumber(normalizeNumber(values.cantidad))
    : null;
  const resolvedPrecio = normalizedArticuloId
    ? normalizeOptionalNumber(normalizeNumber(values.precio))
    : null;

  return {
    proveedorId: normalizedProveedorId,
    tipoSolicitudId: normalizedTipoSolicitudId,
    departamentoId: resolvedDepartamentoId,
    centroCostoId: resolvedCentroCostoId,
    tipoCompra: resolveTipoCompra(normalizedProveedorId),
    articuloId: normalizedArticuloId,
    titulo: values.titulo,
    descripcion: values.descripcion ?? "",
    fechaNecesidad: resolvedFecha,
    oportunidadId: normalizedOportunidadId,
    cantidad: resolvedCantidad,
    precio: resolvedPrecio,
    unidadMedida,
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

// Aplica defaults del wizard al formulario principal.
export const useWizardDefaults = ({
  identityId,
  solicitanteIdValue,
  departamentoIdValue,
  solicitanteDepartamentoIdValue,
  proveedorData,
  articuloIdValue,
  articuloData,
  precioValue,
  setValue,
}: {
  identityId: number | null;
  solicitanteIdValue?: string | null;
  departamentoIdValue?: string | null;
  solicitanteDepartamentoIdValue?: number | null;
  proveedorData?: unknown;
  articuloIdValue?: string | null;
  articuloData?: unknown;
  precioValue?: unknown;
  setValue: SetValueFn;
}) => {
  useEffect(() => {
    if (!identityId) return;
    if (solicitanteIdValue) return;
    setValue("solicitanteId", String(identityId), { shouldDirty: false });
  }, [identityId, solicitanteIdValue, setValue]);

  useEffect(() => {
    if (departamentoIdValue) return;
    if (solicitanteDepartamentoIdValue == null) return;
    setValue("departamentoId", String(solicitanteDepartamentoIdValue), {
      shouldDirty: true,
    });
  }, [departamentoIdValue, setValue, solicitanteDepartamentoIdValue]);

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

  useArticuloPrecioDefault({
    articuloData,
    precioValue,
    setValue,
  });
};

//#endregion

//******************************* */
// region 7. EMISION
//#region 

// Orquesta la emision de la solicitud con guardado previo si hace falta.
export const usePoSolicitudCotizar = ({ onClose }: { onClose: () => void }) => {
  const record = useRecordContext<PoSolicitud>();
  const resource = useResourceContext();
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const saveContext = useSaveContext();
  const form = useFormContext<PoSolicitud>();
  const { dirtyFields } = useFormState();
  const [loading, setLoading] = useState(false);

  const isDirty = Object.keys(dirtyFields).length > 0;
  const canCotizar = record?.estado === "pendiente";

  const cotizar = async (openShow: boolean) => {
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
        data: { estado: "cotizada" },
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
    canCotizar,
    cotizar,
    loading,
  };
};

//#endregion

//******************************* */
// region 8. CONFIRMACION
//#region

export const usePoSolicitudConfirm = () => {
  const record = useRecordContext<PoSolicitud>();
  const resource = useResourceContext();
  const saveContext = useSaveContext();
  const form = useFormContext<PoSolicitud>();
  const { dirtyFields } = useFormState();
  const [loading, setLoading] = useState(false);

  const isEditMode = Boolean(record?.id);
  const canConfirm = !isEditMode || record?.estado === "borrador";
  const isDirty = Object.keys(dirtyFields).length > 0;

  const confirm = async (onDone?: () => void) => {
    if (!saveContext?.save || !resource) return;
    setLoading(true);
    const previousEstado = form.getValues("estado");
    form.setValue("estado", "pendiente", { shouldDirty: true });
    try {
      if (isDirty) {
        const errors = await saveContext.save({
          ...form.getValues(),
          estado: "pendiente",
        });
        if (errors) {
          form.setValue("estado", previousEstado, { shouldDirty: true });
          return;
        }
      } else {
        const errors = await saveContext.save({
          ...form.getValues(),
          estado: "pendiente",
        });
        if (errors) {
          form.setValue("estado", previousEstado, { shouldDirty: true });
          return;
        }
      }
      onDone?.();
    } finally {
      setLoading(false);
    }
  };

  return { canConfirm, confirm, loading };
};

//#endregion
