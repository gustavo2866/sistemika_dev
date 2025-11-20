"use client";

import { Create } from "@/components/create";
import { EmprendimientoForm } from "./form";

export const EmprendimientoCreate = () => (
  <Create redirect="list" title="Crear Emprendimiento">
    <EmprendimientoForm />
  </Create>
);
