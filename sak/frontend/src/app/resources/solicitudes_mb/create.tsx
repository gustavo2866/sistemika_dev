"use client";

import { useCallback } from "react";
import { Create } from "@/components/create";
import { useNotify } from "ra-core";

import { SolicitudMbForm } from "./form";
import type { SolicitudMbFormValues } from "./types";
import {
  getSolicitudMbErrorMessage,
  normalizeSolicitudMbValues,
} from "./helpers";

export const SolicitudMbCreate = () => {
  const notify = useNotify();

  const transform = useCallback((values: SolicitudMbFormValues) => {
    return normalizeSolicitudMbValues(values);
  }, []);

  const mutationOptions = {
    onSuccess: () => {
      notify("Solicitud creada correctamente", { type: "success" });
    },
    onError: (error: unknown) => {
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
