"use client";

import { Create } from "@/components/create";
import { CRMCelularForm } from "./form";

export const CRMCelularCreate = () => (
  <Create redirect="list" title="Crear celular CRM">
    <CRMCelularForm />
  </Create>
);

