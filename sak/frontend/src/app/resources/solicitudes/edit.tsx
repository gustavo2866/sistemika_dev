"use client";

import { useCallback } from "react";
import { Edit } from "@/components/edit";
import { useNotify } from "ra-core";

import { SolicitudForm } from "./form/Form";
import {
  getSolicitudErrorMessage,
  normalizeSolicitudValues,
  type SolicitudFormValues,
} from "./model";

export const SolicitudEdit = () => {
  const notify = useNotify();

  const transform = useCallback((values: SolicitudFormValues) => {
    return normalizeSolicitudValues(values);
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
