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

// === Tipos ===
export type PoOrderRecord = PoOrderFormValues & {
  id?: Identifier;
  order_status?: {
    id?: number | null;
    nombre?: string | null;
  } | null;
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
export const usePoOrderDefaults = () => {
  const dataProvider = useDataProvider();
  const record = useRecordContext<
    PoOrderFormValues & { order_status?: { id?: number; nombre?: string } }
  >();
  const { setValue, getValues, control } = useFormContext();
  const { dirtyFields } = useFormState({ control });

  const solicitanteId = useWatch({ name: "solicitante_id" }) as number | undefined;
  const proveedorId = useWatch({ name: "proveedor_id" }) as number | undefined;
  const departamentoId = useWatch({ name: "departamento_id" }) as number | undefined;
  const centroCostoId = useWatch({ name: "centro_costo_id" }) as number | undefined;
  const estadoOrdenId = useWatch({ name: "order_status_id" }) as number | undefined;
  const metodoPagoId = useWatch({ name: "metodo_pago_id" }) as number | undefined;
  const tipoCompraActual = useWatch({ name: "tipo_compra" }) as string | undefined;
  const [estadoOrdenNombre, setEstadoOrdenNombre] = useState<string | undefined>();
  const estadoOrdenIdRegistro = record?.order_status_id ?? record?.order_status?.id;

  useEffect(() => {
    if (!solicitanteId) return;
    if (departamentoId && centroCostoId) return;

    let active = true;
    (async () => {
      const { data: usuario } = await dataProvider.getOne("users", {
        id: solicitanteId,
      });
      if (!active) return;

      if (!departamentoId && usuario?.departamento_id && !dirtyFields?.departamento_id) {
        const currentDepartamento = getValues("departamento_id");
        if (!currentDepartamento) {
          setValue("departamento_id", usuario.departamento_id, {
            shouldDirty: false,
          });
        }
      }

      const deptoId = departamentoId ?? usuario?.departamento_id;
      if (!deptoId) return;

      if (!centroCostoId && !dirtyFields?.centro_costo_id) {
        const { data: depto } = await dataProvider.getOne("departamentos", {
          id: deptoId,
        });
        if (!active) return;
        if (depto?.centro_costo_id) {
          const currentCentro = getValues("centro_costo_id");
          if (!currentCentro) {
            setValue("centro_costo_id", depto.centro_costo_id, {
              shouldDirty: false,
            });
          }
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    solicitanteId,
    departamentoId,
    centroCostoId,
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
    setValue("tipo_compra", "normal", { shouldDirty: false });
  }, [tipoCompraActual, dirtyFields?.tipo_compra, setValue]);

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
        const errors = await saveContext.save({
          ...form.getValues(),
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
        const errors = await saveContext.save(form.getValues());
        if (errors) {
          return;
        }
      }

      await dataProvider.update(resource, {
        id: record.id,
        data: { order_status_id: status.id },
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
