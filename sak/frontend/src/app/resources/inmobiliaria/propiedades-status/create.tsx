"use client";

import { Create } from "@/components/create";
import { PropiedadesStatusForm } from "./form";

export const PropiedadesStatusCreate = () => (
  <Create redirect="list" title="Crear estado de propiedad">
    <PropiedadesStatusForm />
  </Create>
);
