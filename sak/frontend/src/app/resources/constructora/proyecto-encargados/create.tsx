"use client";

import { Create } from "@/components/create";
import { useLocation } from "react-router-dom";
import { ProyectoEncargadoForm } from "./form";
import {
  PROYECTO_ENCARGADO_DEFAULT,
  normalizeProyectoEncargadoPayload,
  type ProyectoEncargadoFormValues,
} from "./model";

type ProyectoEncargadoCreateState = {
  proyecto_id?: number | string | null;
  returnTo?: string | null;
};

export const ProyectoEncargadoCreate = () => {
  const location = useLocation();
  const locationState = location.state as ProyectoEncargadoCreateState | null;
  const defaultValues: ProyectoEncargadoFormValues = {
    ...PROYECTO_ENCARGADO_DEFAULT,
    proyecto_id:
      locationState?.proyecto_id != null
        ? Number(locationState.proyecto_id)
        : PROYECTO_ENCARGADO_DEFAULT.proyecto_id,
  };

  return (
    <Create
      title="Crear encargado de proyecto"
      className="max-w-3xl w-full"
      redirect={locationState?.returnTo ?? undefined}
      transform={(data: any) => normalizeProyectoEncargadoPayload(data)}
    >
      <ProyectoEncargadoForm defaultValues={defaultValues} />
    </Create>
  );
};
