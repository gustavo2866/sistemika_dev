"use client";

import { Create } from "@/components/create";
import { TipoActualizacionForm } from "./form";

export const TipoActualizacionCreate = () => (
  <Create redirect="list" title="Crear tipo de actualizacion">
    <TipoActualizacionForm />
  </Create>
);
