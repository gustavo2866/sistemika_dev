"use client";

import { Create } from "@/components/create";
import { TaxProfileForm } from "./form";

export const TaxProfileCreate = () => (
  <Create redirect="list" title="Crear Perfil de Impuestos">
    <TaxProfileForm />
  </Create>
);
