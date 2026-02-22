"use client";

import { useState } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";

import { useIdentityId } from "@/components/forms/form_order";
import type { Propiedad } from "./model";
import { getPropiedadStatusLabel } from "./status_transitions";

type ChangeStatusPayload = {
  record: Propiedad;
  nextStatusId: number;
  fechaCambio: string;
  comentario?: string;
};

export const usePropiedadStatusTransition = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identityId } = useIdentityId();
  const [loading, setLoading] = useState(false);

  const cambiarEstado = async ({
    record,
    nextStatusId,
    fechaCambio,
    comentario,
  }: ChangeStatusPayload) => {
    if (!record?.id) return false;
    if (!fechaCambio) {
      notify("Selecciona la fecha del cambio", { type: "warning" });
      return false;
    }
    if (!identityId) {
      notify("No se pudo identificar el usuario", { type: "warning" });
      return false;
    }

    const estadoNuevoNombre = getPropiedadStatusLabel(nextStatusId);
    const motivo = comentario?.trim() ? comentario.trim() : null;

    setLoading(true);
    try {
      await dataProvider.update("propiedades", {
        id: record.id,
        data: {
          propiedad_status_id: nextStatusId,
          estado_fecha: fechaCambio,
          estado_comentario: motivo,
          usuario_id: identityId,
        },
        previousData: record,
      });

      refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("propiedades-dashboard-refresh"));
      }
      notify(`Estado actualizado a ${estadoNuevoNombre}`, { type: "info" });
      return true;
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar el estado", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { cambiarEstado, loading };
};
