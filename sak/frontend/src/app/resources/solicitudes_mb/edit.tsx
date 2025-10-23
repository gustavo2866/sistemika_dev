"use client";

import { useCallback } from "react";
import { Edit } from "@/components/edit";
import { useNotify } from "ra-core";

import { SolicitudMbForm } from "./form";
import type { SolicitudMbFormValues } from "./types";
import {
  getSolicitudMbErrorMessage,
  normalizeSolicitudMbValues,
} from "./helpers";

export const SolicitudMbEdit = () => {
  const notify = useNotify();

  const transform = useCallback((values: SolicitudMbFormValues) => {
    const payload = normalizeSolicitudMbValues(values);
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
        getSolicitudMbErrorMessage(
          error,
          "No se pudo actualizar la solicitud",
        ),
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
      <SolicitudMbForm />
    </Edit>
  );
};
