"use client";

import { Create } from "@/components/create";
import { PoInvoiceStatusForm } from "./form";

export const PoInvoiceStatusCreate = () => (
  <Create redirect="list" title="Crear estado de factura">
    <PoInvoiceStatusForm />
  </Create>
);
