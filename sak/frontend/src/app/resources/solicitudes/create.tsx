"use client";

import { useCallback } from "react";
import { Create } from "@/components/create";
import { useNotify } from "ra-core";

import { SolicitudForm } from "./form/Form";
import {
  getSolicitudErrorMessage,
  SolicitudFormSchema,
  type SolicitudPayload,
  type SolicitudFormValues,
} from "./model";
import { buildPayload } from "@/components/form/helpers/detailHelpers";

export const SolicitudCreate = () => {
  const notify = useNotify();

  const transform = useCallback((values: SolicitudFormValues) => {
    const payload = buildPayload(
      SolicitudFormSchema,
      values as Record<string, unknown>,
    ) as SolicitudPayload;

    return {
      ...payload,
      comentario: payload.comentario ?? null,
      detalles: Array.isArray(payload.detalles) ? payload.detalles : [],
    };
  }, []);

  const mutationOptions = {
    onSuccess: () => {
      notify("Solicitud creada correctamente", { type: "success" });
    },
    onError: (error: unknown) => {
      notify(getSolicitudErrorMessage(error, "No se pudo guardar la solicitud"), {
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
