"use client";

import { Create } from "@/components/create";
import { MonedaForm } from "./form";

export const MonedaCreate = () => (
  <Create redirect="list" title="Crear Moneda">
    <MonedaForm />
  </Create>
);
