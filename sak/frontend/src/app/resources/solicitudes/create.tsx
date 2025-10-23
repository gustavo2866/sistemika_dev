"use client";

import { useCallback } from "react";
import { Create } from "@/components/create";
import { useNotify } from "ra-core";

import { SolicitudForm, type SolicitudFormValues } from "./form";
import {
  getErrorMessage,
  normalizeSolicitudValues,
} from "./helpers";

export const SolicitudCreate = () => {
  const notify = useNotify();

  const transform = useCallback((values: SolicitudFormValues) => {
    return normalizeSolicitudValues(values);
  }, []);

  const mutationOptions = {
    onSuccess: () => {
      notify("Solicitud creada correctamente", { type: "success" });
    },
    onError: (error: unknown) => {
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
