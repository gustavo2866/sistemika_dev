"use client";

import { Create } from "@/components/create";
import { CRMEventoForm } from "./form";

export const CRMEventoCreate = () => (
  <Create redirect="list" title="Crear Evento CRM">
    <CRMEventoForm />
  </Create>
);
