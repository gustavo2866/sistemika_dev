"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import {
  type Identifier,
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useResourceContext,
  useSaveContext,
  useCreatePath,
} from "ra-core";
import { useNavigate } from "react-router-dom";
import { useConfirmDelete, useIdentityId } from "@/components/forms/form_order";
import {
  capitalizeStatusName,
  isPoOrderLocked,
  normalizeStatusName,
  type PoOrderFormValues,
} from "./model";

const resolveNumericId = (value: unknown) => {
  if (value == null) return undefined;
  if (typeof value === "object") {
    const maybeId = (value as { id?: unknown; value?: unknown }).id ??
      (value as { value?: unknown }).value;
    return resolveNumericId(maybeId);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "0") return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  return undefined;
};

const resolveCentroCostoFromSolicitante = async (
  dataProvider: ReturnType<typeof useDataProvider>,
  solicitanteId: unknown,
) => {
  const resolvedSolicitanteId = resolveNumericId(solicitanteId);
  if (!resolvedSolicitanteId) return undefined;
  const { data: usuario } = await dataProvider.getOne("users", {
    id: resolvedSolicitanteId,
  });
  const deptoId = resolveNumericId(usuario?.departamento_id);
  if (!deptoId) return undefined;
  const { data: depto } = await dataProvider.getOne("departamentos", {
    id: deptoId,
  });
  return resolveNumericId(depto?.centro_costo_id);
};

export const ensureCentroCostoIfMissing = async ({
  dataProvider,
  values,
  setValue,
}: {
  dataProvider: ReturnType<typeof useDataProvider>;
  values: Partial<PoOrderFormValues> | null | undefined;
  setValue?: ReturnType<typeof useFormContext<PoOrderFormValues>>["setValue"];
}) => {
  if (!values) return values;
  const centroActual = resolveNumericId(values.centro_costo_id);
  const oportunidadActual = resolveNumericId(values.oportunidad_id);
  if (centroActual || oportunidadActual) return values;
  const centroFromSolicitante = await resolveCentroCostoFromSolicitante(
    dataProvider,
    values.solicitante_id,
  );
  if (!centroFromSolicitante) return values;
  if (setValue) {
    setValue("centro_costo_id", centroFromSolicitante, { shouldDirty: true });
  }
  return { ...values, centro_costo_id: centroFromSolicitante };
};

// === Tipos ===
export type PoOrderRecord = PoOrderFormValues & {
  id?: Identifier;
  order_status?: {
    id?: number | null;
    nombre?: string | null;
    orden?: number | null;
  } | null;
};

export const isPoOrderEditableByOrden = (orden?: number | null) => {
  if (orden == null) return false;
  return [1, 2, 3].includes(Number(orden));
};

export const usePoOrderReadOnly = () => {
  const record = useRecordContext<PoOrderRecord>();
  const { control } = useFormContext<PoOrderFormValues>();
  const formStatusId = useWatch({ name: "order_status_id", control }) as
    | number
    | undefined;
  const isCreate = !record?.id;
  if (isCreate) return false;
  const orden =
    record?.order_status?.orden ??
    record?.order_status?.id ??
    formStatusId;
  if (orden == null) return true;
  return !isPoOrderEditableByOrden(orden);
};

export const useSolicitanteCentroCostoSync = () => {
  const dataProvider = useDataProvider();
  const { setValue, getValues } = useFormContext<PoOrderFormValues>();
  const oportunidadId = useWatch({ name: "oportunidad_id" }) as unknown;
  const prevSolicitanteId = useRef<number | undefined>(undefined);

  const handleSolicitanteChange = useCallback(
    async (choice: { id?: unknown; value?: unknown } | null) => {
      const nextId = resolveNumericId(choice?.id ?? choice?.value ?? choice);
      if (!nextId) return;

      if (prevSolicitanteId.current === nextId) return;
      prevSolicitanteId.current = nextId;

      const currentOportunidad =
        resolveNumericId(getValues("oportunidad_id")) ??
        resolveNumericId(oportunidadId);
      if (currentOportunidad) return;

      try {
        const { data: usuario } = await dataProvider.getOne("users", {
          id: nextId,
        });

        const deptoId = resolveNumericId(usuario?.departamento_id);
        if (deptoId) {
          setValue("departamento_id", deptoId, { shouldDirty: true });
        } else {
          setValue("departamento_id", undefined, { shouldDirty: true });
          setValue("centro_costo_id", undefined, { shouldDirty: true });
          return;
        }

        const { data: depto } = await dataProvider.getOne("departamentos", {
          id: deptoId,
        });
        const centroId = resolveNumericId(depto?.centro_costo_id);
        if (centroId) {
          setValue("centro_costo_id", centroId, { shouldDirty: true });
        } else {
          setValue("centro_costo_id", undefined, { shouldDirty: true });
        }
      } catch (error) {
        console.error(error);
      }
    },
    [dataProvider, getValues, oportunidadId, setValue],
  );

  return { handleSolicitanteChange };
};

// === Defaults iniciales ===
// Resuelve defaults del formulario en base a identidad y fecha actual.
export const usePoOrderFormDefaults = () => {
  const record = useRecordContext<PoOrderFormValues & { id?: Identifier }>();
  const isCreate = !record?.id;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { identityId, isIdentityLoading } = useIdentityId();

  const defaultValues = useMemo(() => {
    if (!isCreate) return undefined;
    return {
      ...(identityId != null ? { solicitante_id: identityId } : {}),
      fecha_necesidad: today,
    };
  }, [isCreate, identityId, today]);

  return {
    defaultValues,
    isLoadingDefaults: isCreate && isIdentityLoading && identityId == null,
  };
};

// === Acciones de cabecera ===
// Acciones del menu de cabecera y estado de eliminacion.
export const useAccionesCabeceraOrden = () => {
  const record = useRecordContext<PoOrderRecord>();
  const resource = useResourceContext();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const { confirmDelete, setConfirmDelete, deleting, handleDelete } =
    useConfirmDelete({ record, resource });

  const isLocked = isPoOrderLocked(record?.order_status?.nombre);
  const canPreview = Boolean(record?.id && resource);
  const canDelete = canPreview && !isLocked;

  const onPreview = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!record?.id || !resource) return;
      navigate(createPath({ resource, type: "show", id: record.id }));
    },
    [record?.id, resource, navigate, createPath],
  );

  const onRequestDelete = useCallback(() => {
    setConfirmDelete(true);
  }, [setConfirmDelete]);

  return {
    canPreview,
    canDelete,
    onPreview,
    onRequestDelete,
    confirmDelete,
    setConfirmDelete,
    deleting,
    handleDelete,
    isLocked,
  };
};

// === Defaults y dependencias de cabecera ===
// Aplica defaults y dependencias basadas en solicitante, proveedor y estado.
export const usePoOrderDefaults = (
  initialCreateTipoCompra?: "normal" | "directa",
) => {
  const dataProvider = useDataProvider();
  const record = useRecordContext<
    PoOrderFormValues & { id?: number; order_status?: { id?: number; nombre?: string; orden?: number } }
  >();
  const { setValue, getValues, control } = useFormContext();
  const { dirtyFields } = useFormState({ control });
  const isCreate = !record?.id;

  const solicitanteId = useWatch({ name: "solicitante_id" }) as number | undefined;
  const proveedorId = useWatch({ name: "proveedor_id" }) as number | undefined;
  const oportunidadId = useWatch({ name: "oportunidad_id" }) as number | undefined;
  const estadoOrdenId = useWatch({ name: "order_status_id" }) as number | undefined;
  const metodoPagoId = useWatch({ name: "metodo_pago_id" }) as number | undefined;
  const tipoCompraActual = useWatch({ name: "tipo_compra" }) as string | undefined;
  const [estadoOrdenNombre, setEstadoOrdenNombre] = useState<string | undefined>();
  const estadoOrdenIdRegistro = record?.order_status_id ?? record?.order_status?.id;

  const prevSolicitanteId = useRef<number | undefined>(undefined);



  useEffect(() => {
    const resolvedSolicitanteId = resolveNumericId(solicitanteId);
    if (!resolvedSolicitanteId) return;

    const resolvedOportunidadId = resolveNumericId(oportunidadId);
    const prevValue = prevSolicitanteId.current;
    const changed =
      prevValue != null && Number(prevValue) !== Number(resolvedSolicitanteId);
    const forceDefaults = changed && !resolvedOportunidadId;

    if (prevValue == null || changed) {
      prevSolicitanteId.current = resolvedSolicitanteId;
    }

    const currentDepartamento = resolveNumericId(getValues("departamento_id"));
    const currentCentro = resolveNumericId(getValues("centro_costo_id"));

    const shouldSetDepartamento =
      forceDefaults ||
      (!currentDepartamento && !dirtyFields?.departamento_id);
    const shouldSetCentro =
      forceDefaults || (!currentCentro && !dirtyFields?.centro_costo_id);

    if (!shouldSetDepartamento && !shouldSetCentro) return;

    let active = true;
    (async () => {
      const { data: usuario } = await dataProvider.getOne("users", {
        id: resolvedSolicitanteId,
      });
      if (!active) return;

      const deptoId =
        resolveNumericId(usuario?.departamento_id) ?? currentDepartamento;

      if (shouldSetDepartamento && deptoId) {
        setValue("departamento_id", deptoId, {
          shouldDirty: forceDefaults,
        });
      }

      if (!deptoId) {
        if (forceDefaults && shouldSetCentro) {
          setValue("centro_costo_id", null, { shouldDirty: true });
        }
        return;
      }

      if (shouldSetCentro) {
        const { data: depto } = await dataProvider.getOne("departamentos", {
          id: deptoId,
        });
        if (!active) return;
        const deptoCentro = resolveNumericId(depto?.centro_costo_id);
        if (deptoCentro) {
          setValue("centro_costo_id", deptoCentro, {
            shouldDirty: forceDefaults,
          });
        } else if (forceDefaults) {
          setValue("centro_costo_id", null, { shouldDirty: true });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    solicitanteId,
    oportunidadId,
    dataProvider,
    getValues,
    setValue,
    dirtyFields?.departamento_id,
    dirtyFields?.centro_costo_id,
  ]);

  useEffect(() => {
    if (estadoOrdenId || (dirtyFields as any)?.order_status_id) return;
    if (estadoOrdenIdRegistro) {
      setValue("order_status_id", estadoOrdenIdRegistro, { shouldDirty: false });
      if (record?.order_status?.nombre) {
        setEstadoOrdenNombre(record.order_status.nombre);
      }
      return;
    }
    let active = true;
    (async () => {
      const { data } = await dataProvider.getList("po-order-status", {
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
        filter: { nombre: "Borrador" },
      });
      if (!active) return;
      const status = data?.[0];
      if (status?.id) {
        setValue("order_status_id", status.id, { shouldDirty: false });
        setEstadoOrdenNombre(status.nombre);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    estadoOrdenId,
    estadoOrdenIdRegistro,
    record?.order_status?.nombre,
    dirtyFields,
    dataProvider,
    setValue,
  ]);

  useEffect(() => {
    if (metodoPagoId || dirtyFields?.metodo_pago_id) return;
    setValue("metodo_pago_id", 1, { shouldDirty: false });
  }, [metodoPagoId, dirtyFields?.metodo_pago_id, setValue]);

  useEffect(() => {
    if (!proveedorId) return;
    let active = true;
    (async () => {
      const { data: proveedor } = await dataProvider.getOne("proveedores", {
        id: proveedorId,
      });
      if (!active) return;
      const defaults = proveedor as
        | {
            default_metodo_pago_id?: number | null;
            default_tipo_solicitud_id?: number | null;
          }
        | undefined;
      const defaultMetodo = defaults?.default_metodo_pago_id;
      const defaultTipoSolicitud = defaults?.default_tipo_solicitud_id;
      if (!defaultMetodo) return;
      const currentMetodo = getValues("metodo_pago_id");
      const isEmpty =
        currentMetodo == null ||
        (typeof currentMetodo === "string" && currentMetodo.trim() === "") ||
        (typeof currentMetodo === "number" && currentMetodo <= 0);
      if (isEmpty || !dirtyFields?.metodo_pago_id) {
        setValue("metodo_pago_id", Number(defaultMetodo), {
          shouldDirty: true,
        });
      }
      if (defaultTipoSolicitud) {
        const currentTipo = getValues("tipo_solicitud_id");
        const isTipoEmpty =
          currentTipo == null ||
          (typeof currentTipo === "string" && currentTipo.trim() === "") ||
          (typeof currentTipo === "number" && currentTipo <= 0);
        if (isTipoEmpty || !(dirtyFields as any)?.tipo_solicitud_id) {
          setValue("tipo_solicitud_id", Number(defaultTipoSolicitud), {
            shouldDirty: true,
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [
    proveedorId,
    dataProvider,
    getValues,
    setValue,
    dirtyFields,
    dirtyFields?.metodo_pago_id,
  ]);

  useEffect(() => {
    if (tipoCompraActual || dirtyFields?.tipo_compra) return;
    setValue(
      "tipo_compra",
      isCreate ? (initialCreateTipoCompra ?? "normal") : "normal",
      { shouldDirty: false },
    );
  }, [tipoCompraActual, dirtyFields?.tipo_compra, initialCreateTipoCompra, isCreate, setValue]);

  useEffect(() => {
    if (!estadoOrdenId || estadoOrdenNombre) return;
    let active = true;
    (async () => {
      const { data } = await dataProvider.getOne("po-order-status", {
        id: estadoOrdenId,
      });
      if (!active) return;
      if (data?.nombre) {
        setEstadoOrdenNombre(data.nombre);
      }
    })();
    return () => {
      active = false;
    };
  }, [estadoOrdenId, estadoOrdenNombre, dataProvider]);

  return { orderStatusLabel: estadoOrdenNombre };
};

// === Transiciones de estado ===
// Gestiona transiciones de estado de orden y persistencia asociada.
export const usePoOrderStatusTransition = () => {
  const record = useRecordContext<PoOrderRecord>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const resourceContext = useResourceContext();
  const resource = resourceContext ?? "po-orders";
  const saveContext = useSaveContext();
  const form = useFormContext<PoOrderFormValues>();
  const { dirtyFields } = useFormState({ control: form.control });
  const orderStatusId = useWatch({ name: "order_status_id" }) as number | undefined;
  const [estadoActualNombre, setEstadoActualNombre] = useState<string | undefined>(
    record?.order_status?.nombre ?? undefined,
  );
  const ultimoEstadoIdRef = useRef<number | undefined>(
    record?.order_status?.id ?? orderStatusId
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (record?.order_status?.nombre) {
      setEstadoActualNombre(record.order_status.nombre);
    }
    if (record?.order_status?.id) {
      ultimoEstadoIdRef.current = record.order_status.id;
    }
  }, [record?.order_status?.nombre, record?.order_status?.id]);

  useEffect(() => {
    if (!orderStatusId) return;
    if (ultimoEstadoIdRef.current === orderStatusId && estadoActualNombre) return;
    let active = true;
    (async () => {
      const { data } = await dataProvider.getOne("po-order-status", {
        id: orderStatusId,
      });
      if (!active) return;
      if (data?.nombre) {
        setEstadoActualNombre(data.nombre);
        ultimoEstadoIdRef.current = orderStatusId;
      }
    })();
    return () => {
      active = false;
    };
  }, [orderStatusId, estadoActualNombre, dataProvider]);

  const estadoKey = useMemo(
    () => normalizeStatusName(estadoActualNombre),
    [estadoActualNombre]
  );

  const canSolicitar = estadoKey === "borrador";
  const canEmitir = estadoKey === "solicitada";
  const canGenerar = estadoKey === "borrador" || estadoKey === "solicitada";

  const resolverEstadoPorNombre = async (statusName: string) => {
    const candidates = [
      statusName,
      capitalizeStatusName(statusName),
      statusName.toUpperCase(),
    ];
    for (const candidate of candidates) {
      const { data } = await dataProvider.getList("po-order-status", {
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
        filter: { nombre: candidate },
      });
      const status = data?.[0];
      if (status?.id) {
        return { id: status.id as number, nombre: status.nombre as string };
      }
    }
    return null;
  };

  const cambiarEstado = async (nextStatus: "borrador" | "solicitada" | "emitida") => {
    setLoading(true);
    try {
      const status = await resolverEstadoPorNombre(nextStatus);
      if (!status?.id) {
        notify(`No se encontró el estado "${nextStatus}"`, { type: "warning" });
        return;
      }

      if (!record?.id) {
        if (!saveContext?.save) return;
        const previousStatus = form.getValues("order_status_id");
        form.setValue("order_status_id", status.id, { shouldDirty: true });
        const patchedValues = await ensureCentroCostoIfMissing({
          dataProvider,
          values: form.getValues(),
          setValue: form.setValue,
        });
        const errors = await saveContext.save({
          ...(patchedValues ?? form.getValues()),
          order_status_id: status.id,
        });
        if (errors) {
          form.setValue("order_status_id", previousStatus, { shouldDirty: true });
          return;
        }
        setEstadoActualNombre(status.nombre);
        ultimoEstadoIdRef.current = status.id;
        notify(`Estado actualizado a ${status.nombre}`, { type: "info" });
        return;
      }

      if (Object.keys(dirtyFields).length > 0 && saveContext?.save) {
        const patchedValues = await ensureCentroCostoIfMissing({
          dataProvider,
          values: form.getValues(),
          setValue: form.setValue,
        });
        const errors = await saveContext.save(patchedValues ?? form.getValues());
        if (errors) {
          return;
        }
      }

      const patchedValues = await ensureCentroCostoIfMissing({
        dataProvider,
        values: form.getValues(),
        setValue: form.setValue,
      });
      const centroId = (patchedValues as PoOrderFormValues | undefined)?.centro_costo_id;
      await dataProvider.update(resource, {
        id: record.id,
        data: {
          order_status_id: status.id,
          ...(centroId ? { centro_costo_id: centroId } : {}),
        },
        previousData: record,
      });

      form.setValue("order_status_id", status.id, { shouldDirty: false });
      setEstadoActualNombre(status.nombre);
      ultimoEstadoIdRef.current = status.id;
      refresh();
      notify(`Estado actualizado a ${status.nombre}`, { type: "info" });
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar el estado", { type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  return {
    currentStatusName: estadoActualNombre,
    canSolicitar,
    canEmitir,
    canGenerar,
    cambiarEstado,
    loading,
  };
};
