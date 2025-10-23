"use client";

import { useCallback } from "react";
import { Edit } from "@/components/edit";
import { useNotify } from "ra-core";

import { SolicitudForm, type SolicitudFormValues } from "./form";
import { getErrorMessage, normalizeSolicitudValues } from "./helpers";

export const SolicitudEdit = () => {
  const notify = useNotify();

  const transform = useCallback((values: SolicitudFormValues) => {
    const payload = normalizeSolicitudValues(values);
    return {
      ...payload,
      id: values.id,
    };
  }, []);

  const mutationOptions = {
    onSuccess: () => {
      notify("Solicitud actualizada correctamente", { type: "success" });
    },
    onError: (error: unknown) => {
      notify(
        getErrorMessage(error, "No se pudo actualizar la solicitud"),
        { type: "error" },
      );
    },
  };

  return (
    <Edit
      redirect="list"
      title="Editar solicitud"
      transform={transform}
      mutationOptions={mutationOptions}
    >
      <SolicitudForm />
    </Edit>
  );
};
