"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { useDataProvider, useRecordContext } from "ra-core";
import type { PoOrderFormValues } from "./model";

export const usePoOrderDefaults = () => {
  const dataProvider = useDataProvider();
  const record = useRecordContext<
    PoOrderFormValues & { order_status?: { id?: number; nombre?: string } }
  >();
  const { setValue, getValues, control } = useFormContext();
  const { dirtyFields } = useFormState({ control });

  const solicitanteId = useWatch({ name: "solicitante_id" }) as number | undefined;
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
