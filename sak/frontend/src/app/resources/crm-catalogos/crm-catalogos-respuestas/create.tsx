"use client";

import { Create } from "@/components/create";
import { CRMCatalogoRespuestaForm } from "./form";

export const CRMCatalogoRespuestaCreate = () => (
  <Create redirect="list" title="Crear Respuesta CRM">
    <CRMCatalogoRespuestaForm />
  </Create>
);
