"use client";

import { Create } from "@/components/create";
import { TipoComprobanteForm } from "./form";

export const TipoComprobanteCreate = () => (
  <Create redirect="list" title="Crear tipo de comprobante">
    <TipoComprobanteForm />
  </Create>
);
