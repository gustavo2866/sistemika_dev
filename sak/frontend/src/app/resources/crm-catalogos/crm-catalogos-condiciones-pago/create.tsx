"use client";

import { Create } from "@/components/create";
import { CRMCondicionPagoForm } from "./form";

export const CRMCondicionPagoCreate = () => (
  <Create redirect="list" title="Crear Condición de Pago CRM">
    <CRMCondicionPagoForm />
  </Create>
);
