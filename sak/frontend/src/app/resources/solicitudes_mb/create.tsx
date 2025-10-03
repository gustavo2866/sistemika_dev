"use client";

import { useCallback, useRef } from "react";
import { Create } from "@/components/create";
import { useDataProvider, useNotify } from "ra-core";
import type { RaRecord } from "ra-core";

import { SolicitudMbForm } from "./form";
import type { SolicitudMbFormValues } from "./types";
import {
  createSolicitudMbDetalles,
  getSolicitudMbErrorMessage,
  normalizeSolicitudMbValues,
  type SolicitudMbDetailPayload,
} from "./helpers";

export const SolicitudMbCreate = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const detalleBuffer = useRef<SolicitudMbDetailPayload[]>([]);

  const transform = useCallback((values: SolicitudMbFormValues) => {
    const { header, detalles } = normalizeSolicitudMbValues(values);
    detalleBuffer.current = detalles;
    return header;
  }, []);

  const mutationOptions = {
    onSuccess: async (record: RaRecord) => {
      try {
        const solicitudId = record.id;
        if (solicitudId != null) {
          await createSolicitudMbDetalles(
            dataProvider,
            solicitudId,
            detalleBuffer.current,
          );
        }
        notify("Solicitud creada correctamente", { type: "success" });
      } catch (error) {
        notify(
          getSolicitudMbErrorMessage(
            error,
            "Solicitud creada pero hubo un error al guardar los detalles",
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
        getSolicitudMbErrorMessage(error, "No se pudo guardar la solicitud"),
        { type: "error" },
      );
    },
  };

  return (
    <Create
      redirect="list"
      title="Nueva solicitud (MB)"
      transform={transform}
      mutationOptions={mutationOptions}
    >
      <SolicitudMbForm />
    </Create>
  );
};
