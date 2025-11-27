"use client";

import { Create } from "@/components/create";
import { CRMTipoEventoForm } from "./form";

export const CRMTipoEventoCreate = () => (
  <Create redirect="list" title="Crear Tipo de Evento CRM">
    <CRMTipoEventoForm />
  </Create>
);
