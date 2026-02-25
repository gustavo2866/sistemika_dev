"use client";

import { Create } from "@/components/create";
import { PropietarioForm } from "./form";

export const PropietarioCreate = () => (
  <Create redirect="list" title="Crear propietario">
    <PropietarioForm />
  </Create>
);
