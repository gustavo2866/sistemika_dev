"use client";

import { useCallback } from "react";
import { Create } from "@/components/create";
import { useNotify } from "ra-core";

import { SolicitudForm } from "./form/Form";
import {
  getSolicitudErrorMessage,
  normalizeSolicitudValues,
  type SolicitudFormValues,
} from "./model";

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
