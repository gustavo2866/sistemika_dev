"use client";

import { Create } from "@/components/create";
import { PropiedadForm } from "./form";

export const PropiedadCreate = () => (
  <Create redirect="list" title="Crear propiedad">
    <PropiedadForm />
  </Create>
);
