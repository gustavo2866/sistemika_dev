"use client";

import { Create } from "@/components/create";
import { PoInvoiceStatusFinForm } from "./form";

export const PoInvoiceStatusFinCreate = () => (
  <Create redirect="list" title="Crear estado financiero de factura">
    <PoInvoiceStatusFinForm />
  </Create>
);
