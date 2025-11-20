"use client";

import { Create } from "@/components/create";
import { CRMCotizacionForm } from "./form";

export const CRMCotizacionCreate = () => (
  <Create redirect="list" title="Crear Cotización">
    <CRMCotizacionForm />
  </Create>
);
