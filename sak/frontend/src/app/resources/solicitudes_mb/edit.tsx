"use client";

import { useCallback, useRef } from "react";
import { Edit } from "@/components/edit";
import { useDataProvider, useNotify } from "ra-core";
import type { RaRecord } from "ra-core";

import { SolicitudMbForm } from "./form";
import type { SolicitudMbFormValues } from "./types";
import {
  getSolicitudMbErrorMessage,
  normalizeSolicitudMbValues,
  syncSolicitudMbDetalles,
  type SolicitudMbDetailPayload,
} from "./helpers";

export const SolicitudMbEdit = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const detalleBuffer = useRef<SolicitudMbDetailPayload[]>([]);

  const transform = useCallback((values: SolicitudMbFormValues) => {
    const { header, detalles } = normalizeSolicitudMbValues(values);
    detalleBuffer.current = detalles;
    return {
      ...header,
      id: values.id,
    };
  }, []);

  const mutationOptions = {
    onSuccess: async (record: RaRecord) => {
      try {
        const solicitudId = record.id;
        if (solicitudId != null) {
          await syncSolicitudMbDetalles(
            dataProvider,
            solicitudId,
            detalleBuffer.current,
          );
          await dataProvider.getOne("solicitudes", { id: solicitudId });
        }
        notify("Solicitud actualizada correctamente", { type: "success" });
      } catch (error) {
        notify(
          getSolicitudMbErrorMessage(
            error,
            "Solicitud actualizada pero hubo un error al sincronizar los detalles",
          ),
          { type: "warning" },
        );
      } finally {
        detalleBuffer.current = [];
      }
    },
    onError: (error: unknown) => {
      detalleBuffer.current = [];
      notify(
        getSolicitudMbErrorMessage(error, "No se pudo actualizar la solicitud"),
        { type: "error" },
      );
    },
  };

  return (
    <Edit
      redirect="list"
      title="Editar solicitud (MB)"
      transform={transform}
      mutationMode="pessimistic"
      mutationOptions={mutationOptions}
    >
      <SolicitudMbForm isEdit />
    </Edit>
  );
};
