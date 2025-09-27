"use client";

import { Create } from "@/components/create";
import { TipoOperacionForm } from "./form";

export const TipoOperacionCreate = () => (
  <Create redirect="list" title="Crear tipo de operacion">
    <TipoOperacionForm />
  </Create>
);
