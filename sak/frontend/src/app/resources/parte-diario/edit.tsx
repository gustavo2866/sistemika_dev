"use client";

import { Edit } from "@/components/edit";
import { ParteDiarioForm } from "./form";

export const ParteDiarioEdit = () => (
  <Edit redirect="list" title="Editar Parte Diario">
    <ParteDiarioForm />
  </Edit>
);
