"use client";

import { Create } from "@/components/create";
import { CRMMotivoEventoForm } from "./form";

export const CRMMotivoEventoCreate = () => (
  <Create redirect="list" title="Crear Motivo de Evento CRM">
    <CRMMotivoEventoForm />
  </Create>
);
