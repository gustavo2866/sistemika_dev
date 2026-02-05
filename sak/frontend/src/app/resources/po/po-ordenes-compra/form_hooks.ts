/**
 * Hooks y utilidades del formulario de Ordenes de Compra.
 *
 * Estructura:
 * 1. TIPOS - Tipos auxiliares y contratos internos
 * 2. SUBTITULOS - Subtitulos de secciones
 * 3. VISIBILIDAD - Control de secciones
 * 4. DEFAULTS - Defaults por tipo/proveedor
 * 5. WIZARD - Helpers para wizard
 * 6. EMISION - Emision y cambio de estado
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
  normalizeId,
  normalizeNumber,
  normalizeOptionalNumber,
  type PoOrdenCompra,
  type PoOrdenCompraDetalle,
  type WizardPayload,
  OPORTUNIDADES_REFERENCE,
} from "./model";
import { calculateImporte, getDepartamentoDefaultByTipo } from "../shared/po-utils";
import {
  buildPoOrdenCompraCabeceraSubtitle,
  buildPoOrdenCompraImputacionSubtitle,
  resolveTipoCompra,
} from "./transformers";
import {
  useReferenceFieldWatcher,
  useCentroCostoWatcher,
} from "@/components/generic";
import {
  useArticuloPrecioDefault,
  useTipoSolicitudCatalog,
  type TipoSolicitudCatalog,
} from "../shared/po-hooks";

//******************************* */
// region 1. TIPOS

type SetValueFn = (
  name:
    | "titulo"
    | "descripcion"
    | "cantidad"
    | "precio"
    | "proveedorId"
    | "fecha"
    | "usuarioResponsableId"
    | "oportunidadId"
    | "tipoSolicitudId"
    | "tipoCompra"
    | "articuloId"
    | "centroCostoId"
    | "metodoPagoId",
  value: string | number,
  options?: { shouldDirty?: boolean }
) => void;

//******************************* */
// region 2. SUBTITULOS

export const usePoOrdenCompraSectionSubtitles = () => {
  const { data: centroCostoData } = useCentroCostoWatcher("centro_costo_id");
  const { data: oportunidadData } = useReferenceFieldWatcher(
    "oportunidad_id",
    OPORTUNIDADES_REFERENCE.resource,
    { validation: (value) => !!value && typeof value === "object" }
  );
  const { tiposSolicitudCatalog } = useTipoSolicitudCatalog();
  const { control } = useFormContext<PoOrdenCompra & { oportunidad_id?: number }>();
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
      buildPoOrdenCompraCabeceraSubtitle({
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
      buildPoOrdenCompraImputacionSubtitle({
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

export const PoOrdenCompraSectionSubtitle = ({ text }: { text: string }) =>
  createElement(
    "div",
    { className: "text-[10px] leading-none text-muted-foreground sm:text-xs" },
    text
  );

//******************************* */
// region 3. VISIBILIDAD SECCIONES

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

//******************************* */
// region 4. DEFAULTS

export const useTipoSolicitudBloqueado = (detallesValue: unknown) =>
  useMemo(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    return detalles.length > 0;
  }, [detallesValue]);

export const useDepartamentoDefaultByTipo = ({
  form,
  idValue,
  tipoSolicitudValue,
  tiposSolicitudCatalog,
}: {
  form: UseFormReturn<PoOrdenCompra>;
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

export const useProveedorDefaults = ({
  form,
  proveedorId,
}: {
  form: UseFormReturn<PoOrdenCompra>;
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

//******************************* */
// region 5. WIZARD

type ApplyWizardPayloadArgs = {
  isCreate: boolean;
  setValue: UseFormSetValue<PoOrdenCompra & { oportunidad_id?: number }>;
  payload: WizardPayload;
};

type WizardPayloadBuildValues = {
  titulo: string;
  fecha: string;
  proveedorId: string;
  usuarioResponsableId: string;
  oportunidadId: string;
  tipoSolicitudId: string;
  centroCostoId: string;
  solicitudes: Array<{ id: string }>;
  tipoCompra: string;
  articuloId: string;
  cantidad: number;
  precio: number;
  descripcion: string;
};

const buildDetalleFromWizard = (
  payload: WizardPayload
): PoOrdenCompraDetalle | null => {
  if (payload.articuloId == null) return null;
  const cantidad = payload.cantidad ?? 0;
  const precio = payload.precio ?? 0;
  const subtotal = calculateImporte(cantidad, precio);

  return {
    tempId: Date.now(),
    orden_compra_id: 0,
    articulo_id: payload.articuloId,
    descripcion: payload.descripcion ?? "",
    unidad_medida: payload.unidadMedida ?? "UN",
    cantidad,
    precio_unitario: precio,
    subtotal,
    total_linea: subtotal,
    centro_costo_id: payload.centroCostoId ?? null,
    oportunidad_id: payload.oportunidadId ?? null,
    po_solicitud_id: null,
  };
};

export const buildWizardPayload = ({
  values,
  proveedorId,
  responsableData,
  proveedorData,
  unidadMedida,
  departamentoData,
}: {
  values: WizardPayloadBuildValues;
  proveedorId: number | null;
  responsableData: { departamento_id?: number | null } | null;
  proveedorData?: unknown;
  unidadMedida: string;
  departamentoData?: { centro_costo_id?: number | null } | null;
}): WizardPayload => {
  const normalizedProveedorId = proveedorId ?? normalizeId(values.proveedorId);
  const normalizedTipoSolicitudId = normalizeId(values.tipoSolicitudId);
  const normalizedCentroCostoId = normalizeId(values.centroCostoId);
  const normalizedArticuloId = normalizeId(values.articuloId);
  const normalizedOportunidadId = normalizeId(values.oportunidadId);
  const normalizedResponsableId = normalizeId(values.usuarioResponsableId);
  const normalizedSolicitudIds = (values.solicitudes ?? [])
    .map((item) => normalizeId(item?.id))
    .filter((value): value is number => value != null);
  const resolvedDepartamentoId =
    responsableData?.departamento_id != null
      ? Number(responsableData.departamento_id)
      : null;
  const departamentoCentroCostoId = departamentoData?.centro_costo_id ?? null;
  const resolvedCentroCostoId =
    normalizedCentroCostoId ??
    (departamentoCentroCostoId != null
      ? Number(departamentoCentroCostoId)
      : null);
  const defaultMetodoPagoId =
    (proveedorData as { default_metodo_pago_id?: number | null } | undefined)
      ?.default_metodo_pago_id ?? 1;
  const normalizedMetodoPagoId =
    defaultMetodoPagoId != null ? Number(defaultMetodoPagoId) : 1;
  const resolvedFecha =
    values.fecha && String(values.fecha).trim().length > 0
      ? values.fecha
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
    solicitudIds: normalizedSolicitudIds,
    tipoCompra: resolveTipoCompra(normalizedProveedorId),
    articuloId: normalizedArticuloId,
    titulo: values.titulo,
    descripcion: values.descripcion ?? "",
    fecha: resolvedFecha,
    oportunidadId: normalizedOportunidadId,
    cantidad: resolvedCantidad,
    precio: resolvedPrecio,
    unidadMedida,
    usuarioResponsableId: normalizedResponsableId,
    metodoPagoId: normalizedMetodoPagoId,
  };
};

export const applyWizardPayload = ({
  isCreate,
  setValue,
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
  if (payload.oportunidadId != null) {
    setValue("oportunidad_id", payload.oportunidadId, { shouldDirty: true });
  }
  if (payload.tipoCompra != null) {
    setValue("tipo_compra", payload.tipoCompra, { shouldDirty: true });
  }
  if (payload.titulo !== undefined) {
    setValue("titulo", payload.titulo, { shouldDirty: true });
  }
  if (payload.fecha) {
    setValue("fecha", payload.fecha, { shouldDirty: true });
  }
  if (payload.usuarioResponsableId != null) {
    setValue("usuario_responsable_id", payload.usuarioResponsableId, {
      shouldDirty: true,
    });
  }
  if (payload.metodoPagoId != null) {
    setValue("metodo_pago_id", payload.metodoPagoId, { shouldDirty: true });
  }

  if (payload.detalles && payload.detalles.length > 0) {
    setValue("detalles", payload.detalles as any, { shouldDirty: true });
    return;
  }

  const detalle = buildDetalleFromWizard(payload);
  if (detalle) {
    setValue("detalles", [detalle], { shouldDirty: true });
  }
};

export const useWizardDefaults = ({
  responsableIdValue,
  proveedorData,
  articuloIdValue,
  articuloData,
  precioValue,
  setValue,
}: {
  responsableIdValue?: string | null;
  proveedorData?: unknown;
  articuloIdValue?: string | null;
  articuloData?: unknown;
  precioValue?: unknown;
  setValue: SetValueFn;
}) => {
  useEffect(() => {
    if (!responsableIdValue) return;
    setValue("usuarioResponsableId", String(responsableIdValue), {
      shouldDirty: false,
    });
  }, [responsableIdValue, setValue]);

  useEffect(() => {
    const defaultTipoSolicitudId = (proveedorData as any)
      ?.default_tipo_solicitud_id;
    if (defaultTipoSolicitudId) {
      setValue("tipoSolicitudId", String(defaultTipoSolicitudId), {
        shouldDirty: true,
      });
    }
    const defaultArticuloId = (proveedorData as any)?.default_articulos_id;
    if (defaultArticuloId) {
      setValue("articuloId", String(defaultArticuloId), {
        shouldDirty: true,
      });
    }
  }, [proveedorData, setValue]);

  useEffect(() => {
    if (!articuloIdValue || !articuloData) return;
    setValue("descripcion", (articuloData as any)?.descripcion ?? "", {
      shouldDirty: true,
    });
  }, [articuloData, articuloIdValue, setValue]);

  useArticuloPrecioDefault({
    articuloData,
    precioValue,
    setValue,
  });
};

//******************************* */
// region 6. EMISION

export const usePoOrdenCompraEmit = ({ onClose }: { onClose: () => void }) => {
  const record = useRecordContext<PoOrdenCompra>();
  const saveContext = useSaveContext();
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const resourceContext = useResourceContext();
  const form = useFormContext<PoOrdenCompra>();
  const { dirtyFields } = useFormState();
  const [loading, setLoading] = useState(false);
  const resource = resourceContext ?? "po-ordenes-compra";

  const canEmit = record?.estado === "borrador" || record?.estado === "emitida";
  const isDirty = Object.keys(dirtyFields).length > 0;

  const emit = async (openShow: boolean) => {
    if (!record?.id) return;
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
