"use client";

import { Create } from "@/components/create";
import { CRMOportunidadForm } from "./form";

export const CRMOportunidadCreate = () => (
  <Create redirect="list" title="Crear Oportunidad CRM">
    <CRMOportunidadForm />
  </Create>
);
