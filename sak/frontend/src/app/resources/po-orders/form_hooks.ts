"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useDataProvider, useGetIdentity } from "ra-core";

export const usePoOrderDefaults = () => {
  const { data: identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const { setValue } = useFormContext();

  const defaultsApplied = useRef(false);

  const solicitanteId = useWatch({ name: "solicitante_id" }) as number | undefined;
  const departamentoId = useWatch({ name: "departamento_id" }) as number | undefined;
  const centroCostoId = useWatch({ name: "centro_costo_id" }) as number | undefined;
  const orderStatusId = useWatch({ name: "order_status_id" }) as number | undefined;
  const [orderStatusLabel, setOrderStatusLabel] = useState<string | undefined>();

  useEffect(() => {
    if (defaultsApplied.current) return;
    // In edit forms, the value is already present: never override.
    if (solicitanteId) {
      defaultsApplied.current = true;
      return;
    }
    if (!identity?.id) return;
    setValue("solicitante_id", identity.id, { shouldDirty: false });
    defaultsApplied.current = true;
  }, [identity?.id, solicitanteId, setValue]);

  useEffect(() => {
    if (!solicitanteId) return;
    if (departamentoId && centroCostoId) return;

    let active = true;
    (async () => {
      const { data: usuario } = await dataProvider.getOne("users", {
        id: solicitanteId,
      });
      if (!active) return;

      if (!departamentoId && usuario?.departamento_id) {
        setValue("departamento_id", usuario.departamento_id, {
          shouldDirty: false,
        });
      }

      const deptoId = departamentoId ?? usuario?.departamento_id;
      if (!deptoId) return;

      if (!centroCostoId) {
        const { data: depto } = await dataProvider.getOne("departamentos", {
          id: deptoId,
        });
        if (!active) return;
        if (depto?.centro_costo_id) {
          setValue("centro_costo_id", depto.centro_costo_id, {
            shouldDirty: false,
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [solicitanteId, departamentoId, centroCostoId, dataProvider, setValue]);

  useEffect(() => {
    if (orderStatusId) return;
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
  }, [orderStatusId, dataProvider, setValue]);

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
