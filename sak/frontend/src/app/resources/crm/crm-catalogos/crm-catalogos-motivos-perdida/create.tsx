"use client";

import { Create } from "@/components/create";
import { CRMMotivoPerdidaForm } from "./form";

export const CRMMotivoPerdidaCreate = () => (
  <Create redirect="list" title="Crear Motivo de Pérdida CRM">
    <CRMMotivoPerdidaForm />
  </Create>
);
