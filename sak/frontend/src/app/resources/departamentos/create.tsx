"use client";

import { Create } from "@/components/create";
import { DepartamentoForm } from "./form";

export const DepartamentoCreate = () => (
  <Create redirect="list" title="Crear departamento">
    <DepartamentoForm />
  </Create>
);
