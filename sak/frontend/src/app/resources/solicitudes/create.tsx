"use client";

import { useCallback, useRef } from "react";
import { Create } from "@/components/create";
import { useDataProvider, useNotify } from "ra-core";
import type { RaRecord } from "ra-core";

import { SolicitudForm, type SolicitudFormValues } from "./form";
import {
  createSolicitudDetalles,
  getErrorMessage,
  normalizeSolicitudValues,
  type SolicitudDetailPayload,
} from "./helpers";

export const SolicitudCreate = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const detalleBuffer = useRef<SolicitudDetailPayload[]>([]);

  const transform = useCallback((values: SolicitudFormValues) => {
    const { header, detalles } = normalizeSolicitudValues(values);
    detalleBuffer.current = detalles;
    return header;
  }, []);

  const mutationOptions = {
    onSuccess: async (record: RaRecord) => {
      try {
        const solicitudId = record.id;
        if (solicitudId != null) {
          await createSolicitudDetalles(
            dataProvider,
            solicitudId,
            detalleBuffer.current,
          );
        }
        notify("Solicitud creada correctamente", { type: "success" });
      } catch (error) {
        notify(
          getErrorMessage(error, "Solicitud creada pero hubo un error al guardar los detalles"),
          { type: "warning" },
        );
        // No lanzamos el error para permitir el redirect
      } finally {
        detalleBuffer.current = [];
      }
    },
    onError: (error: unknown) => {
      detalleBuffer.current = [];
      notify(getErrorMessage(error, "No se pudo guardar la solicitud"), {
        type: "error",
      });
    },
  };

  return (
    <Create
      redirect="list"
      title="Nueva solicitud"
      transform={transform}
      mutationOptions={mutationOptions}
    >
      <SolicitudForm />
    </Create>
  );
};
