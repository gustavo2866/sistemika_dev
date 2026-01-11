"use client";

import { Create } from "@/components/create";
import { PoFacturaForm } from "./form";

export const PoFacturaCreate = () => (
  <Create redirect="list" title="Nueva Factura">
    <PoFacturaForm />
  </Create>
);
