"use client";

import { Create } from "@/components/create";
import { PoOrdenCompraForm } from "./form";

export const PoOrdenCompraCreate = () => (
  <Create redirect="list" title="Nueva Orden de Compra">
    <PoOrdenCompraForm />
  </Create>
);
