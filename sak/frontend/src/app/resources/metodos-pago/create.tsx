"use client";

import { Create } from "@/components/create";
import { MetodoPagoForm } from "./form";

export const MetodoPagoCreate = () => (
  <Create redirect="list" title="Crear método de pago">
    <MetodoPagoForm />
  </Create>
);
