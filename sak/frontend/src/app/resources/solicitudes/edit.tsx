"use client";

import { useCallback } from "react";
import { Edit } from "@/components/edit";
import { useNotify } from "ra-core";

import { SolicitudForm } from "./form/Form";
import {
  getSolicitudErrorMessage,
  SolicitudFormSchema,
  type SolicitudPayload,
  type SolicitudFormValues,
} from "./model";
import { buildPayload } from "@/components/form/helpers/detailHelpers";

export const SolicitudEdit = () => {
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
      notify("Solicitud actualizada correctamente", { type: "success" });
    },
    onError: (error: unknown) => {
      notify(getSolicitudErrorMessage(error, "No se pudo actualizar la solicitud"), {
        type: "error",
      });
    },
  };

  return (
    <Edit
      mutationOptions={mutationOptions}
      title="Editar solicitud"
      redirect="list"
      transform={transform}
    >
      <SolicitudForm />
    </Edit>
  );
};
