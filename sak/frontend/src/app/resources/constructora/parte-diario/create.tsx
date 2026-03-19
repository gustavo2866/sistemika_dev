"use client";

import { Create } from "@/components/create";
import { ParteDiarioForm } from "./form";

export const ParteDiarioCreate = () => (
  <Create redirect="list" title="Registrar Parte Diario">
    <ParteDiarioForm />
  </Create>
);
