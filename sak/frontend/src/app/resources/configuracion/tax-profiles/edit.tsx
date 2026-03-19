"use client";

import { Edit } from "@/components/edit";
import { TaxProfileForm } from "./form";

export const TaxProfileEdit = () => (
  <Edit redirect="list" title="Editar Perfil de Impuestos" actions={false}>
    <TaxProfileForm />
  </Edit>
);
