"use client";

import { Create } from "@/components/create";
import { CRMTipoOperacionForm } from "./form";

export const CRMTipoOperacionCreate = () => (
  <Create redirect="list" title="Crear Tipo de Operación CRM">
    <CRMTipoOperacionForm />
  </Create>
);
