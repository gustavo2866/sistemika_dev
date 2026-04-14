"use client";

import { Create } from "@/components/create";
import { TipoContratoForm } from "./form";

export const TipoContratoCreate = () => (
  <Create redirect="list" title="Crear tipo de contrato">
    <TipoContratoForm />
  </Create>
);
