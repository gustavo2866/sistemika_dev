"use client";

import { Create } from "@/components/create";
import { ProyFaseForm } from "./form";

export const ProyFaseCreate = () => (
  <Create redirect="list" title="Crear fase de proyecto">
    <ProyFaseForm />
  </Create>
);
