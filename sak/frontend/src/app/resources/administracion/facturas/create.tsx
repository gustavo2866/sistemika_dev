"use client";

import { Create } from "@/components/create";
import { FacturaForm } from "./form";

export const FacturaCreate = () => (
  <Create redirect="list" title="Crear factura">
    <FacturaForm />
  </Create>
);
