"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useResourceContext,
  useSaveContext,
} from "ra-core";
import type { PoOrderFormValues } from "./model";

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
  const orderStatusId = useWatch({ name: "order_status_id" }) as number | undefined;
  const metodoPagoId = useWatch({ name: "metodo_pago_id" }) as number | undefined;
  const tipoCompra = useWatch({ name: "tipo_compra" }) as string | undefined;
  const [orderStatusLabel, setOrderStatusLabel] = useState<string | undefined>();
  const recordOrderStatusId = record?.order_status_id ?? record?.order_status?.id;

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
  }, [solicitanteId, departamentoId, centroCostoId, dataProvider, setValue]);

  useEffect(() => {
    if (orderStatusId || (dirtyFields as any)?.order_status_id) return;
    if (recordOrderStatusId) {
      setValue("order_status_id", recordOrderStatusId, { shouldDirty: false });
      if (record?.order_status?.nombre) {
        setOrderStatusLabel(record.order_status.nombre);
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
        setOrderStatusLabel(status.nombre);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    orderStatusId,
    recordOrderStatusId,
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
  }, [proveedorId, dataProvider, getValues, setValue, dirtyFields?.metodo_pago_id]);

  useEffect(() => {
    if (tipoCompra || dirtyFields?.tipo_compra) return;
    setValue("tipo_compra", "normal", { shouldDirty: false });
  }, [tipoCompra, dirtyFields?.tipo_compra, setValue]);

  useEffect(() => {
    if (!orderStatusId || orderStatusLabel) return;
    let active = true;
    (async () => {
      const { data } = await dataProvider.getOne("po-order-status", {
        id: orderStatusId,
      });
      if (!active) return;
      if (data?.nombre) {
        setOrderStatusLabel(data.nombre);
      }
    })();
    return () => {
      active = false;
    };
  }, [orderStatusId, orderStatusLabel, dataProvider]);

  return { orderStatusLabel };
};

export const useTipoSolicitudChangeGuard = () => {
  const { setValue } = useFormContext();
  const tipoSolicitudId = useWatch({ name: "tipo_solicitud_id" }) as
    | number
    | undefined;
  const detalles = useWatch({ name: "detalles" }) as unknown[] | undefined;

  const prevTipoRef = useRef<number | undefined>(tipoSolicitudId);
  const [pendingTipo, setPendingTipo] = useState<number | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const articuloFilter =
    tipoSolicitudId != null ? { tipo_solicitud_id: tipoSolicitudId } : {};

  useEffect(() => {
    if (prevTipoRef.current === tipoSolicitudId) return;

    const hasDetalles = (detalles ?? []).length > 0;
    if (hasDetalles) {
      setPendingTipo(tipoSolicitudId);
      setConfirmOpen(true);
      // revert until user confirms
      setValue("tipo_solicitud_id", prevTipoRef.current, { shouldDirty: false });
      return;
    }

    prevTipoRef.current = tipoSolicitudId;
  }, [tipoSolicitudId, detalles, setValue]);

  const confirmChange = () => {
    setConfirmOpen(false);
    prevTipoRef.current = pendingTipo;
    setValue("tipo_solicitud_id", pendingTipo, { shouldDirty: true });
    setValue("detalles", [], { shouldDirty: true });
    setPendingTipo(undefined);
  };

  const cancelChange = () => {
    setConfirmOpen(false);
    setPendingTipo(undefined);
  };

  return { articuloFilter, confirmOpen, confirmChange, cancelChange };
};

export const useCentroCostoOportunidadExclusion = () => {
  const { setValue, control } = useFormContext();
  const { dirtyFields } = useFormState({ control });
  const centroCostoId = useWatch({ name: "centro_costo_id" }) as number | undefined;
  const oportunidadId = useWatch({ name: "oportunidad_id" }) as number | undefined;

  const prevCentro = useRef(centroCostoId);
  const prevOportunidad = useRef(oportunidadId);

  useEffect(() => {
    if (centroCostoId === prevCentro.current) return;
    prevCentro.current = centroCostoId;

    if (!dirtyFields?.centro_costo_id) return;
    if (centroCostoId == null) return;
    setValue("oportunidad_id", null, { shouldDirty: true });
  }, [centroCostoId, dirtyFields?.centro_costo_id, setValue]);

  useEffect(() => {
    if (oportunidadId === prevOportunidad.current) return;
    prevOportunidad.current = oportunidadId;

    if (!dirtyFields?.oportunidad_id) return;
    if (oportunidadId == null) return;
    setValue("centro_costo_id", null, { shouldDirty: true });
  }, [oportunidadId, dirtyFields?.oportunidad_id, setValue]);
};

export const useDetalleCentroCostoOportunidadExclusion = () => {
  const { setValue, control } = useFormContext();
  const { dirtyFields } = useFormState({ control });
  const detalles = useWatch({ name: "detalles" }) as
    | Array<Record<string, unknown>>
    | undefined;

  const prevDetalles = useRef<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    const current = detalles ?? [];
    const previous = prevDetalles.current ?? [];

    current.forEach((row, index) => {
      const prevRow = previous[index] ?? {};
      const nextCentro = row?.centro_costo_id as number | undefined;
      const nextOportunidad = row?.oportunidad_id as number | undefined;
      const prevCentro = prevRow?.centro_costo_id as number | undefined;
      const prevOportunidad = prevRow?.oportunidad_id as number | undefined;

      if (nextCentro != null && nextCentro !== prevCentro) {
        const centroDirty = (dirtyFields as any)?.detalles?.[index]
          ?.centro_costo_id;
        if (centroDirty) {
          setValue(`detalles.${index}.oportunidad_id`, null, {
            shouldDirty: true,
          });
        }
      }

      if (nextOportunidad != null && nextOportunidad !== prevOportunidad) {
        const oportunidadDirty = (dirtyFields as any)?.detalles?.[index]
          ?.oportunidad_id;
        if (oportunidadDirty) {
          setValue(`detalles.${index}.centro_costo_id`, null, {
            shouldDirty: true,
          });
        }
      }
    });

    prevDetalles.current = current;
  }, [detalles, dirtyFields, setValue]);
};

const normalizeStatusName = (value?: string | null) =>
  value ? String(value).trim().toLowerCase() : "";

const capitalizeStatusName = (value: string) =>
  value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;

export const usePoOrderStatusTransition = () => {
  const record = useRecordContext<
    PoOrderFormValues & { order_status?: { id?: number; nombre?: string } }
  >();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const resourceContext = useResourceContext();
  const resource = resourceContext ?? "po-orders";
  const saveContext = useSaveContext();
  const form = useFormContext<PoOrderFormValues>();
  const { dirtyFields } = useFormState({ control: form.control });
  const orderStatusId = useWatch({ name: "order_status_id" }) as number | undefined;
  const [currentStatusName, setCurrentStatusName] = useState<string | undefined>(
    record?.order_status?.nombre
  );
  const lastStatusIdRef = useRef<number | undefined>(
    record?.order_status?.id ?? orderStatusId
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (record?.order_status?.nombre) {
      setCurrentStatusName(record.order_status.nombre);
    }
    if (record?.order_status?.id) {
      lastStatusIdRef.current = record.order_status.id;
    }
  }, [record?.order_status?.nombre, record?.order_status?.id]);

  useEffect(() => {
    if (!orderStatusId) return;
    if (lastStatusIdRef.current === orderStatusId && currentStatusName) return;
    let active = true;
    (async () => {
      const { data } = await dataProvider.getOne("po-order-status", {
        id: orderStatusId,
      });
      if (!active) return;
      if (data?.nombre) {
        setCurrentStatusName(data.nombre);
        lastStatusIdRef.current = orderStatusId;
      }
    })();
    return () => {
      active = false;
    };
  }, [orderStatusId, currentStatusName, dataProvider]);

  const statusKey = useMemo(
    () => normalizeStatusName(currentStatusName),
    [currentStatusName]
  );

  const canSolicitar = statusKey === "borrador";
  const canEmitir = statusKey === "solicitada";
  const canGenerar = statusKey === "borrador" || statusKey === "solicitada";

  const resolveStatusIdByName = async (statusName: string) => {
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

  const transition = async (nextStatus: "borrador" | "solicitada" | "emitida") => {
    setLoading(true);
    try {
      const status = await resolveStatusIdByName(nextStatus);
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
        setCurrentStatusName(status.nombre);
        lastStatusIdRef.current = status.id;
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
      setCurrentStatusName(status.nombre);
      lastStatusIdRef.current = status.id;
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
    currentStatusName,
    canSolicitar,
    canEmitir,
    canGenerar,
    transition,
    loading,
  };
};
