"use client";

import { Create } from "@/components/create";
import { ProyectoForm } from "./form";

export const ProyectoCreate = () => (
  <Create redirect="list" title="Crear Proyecto">
    <ProyectoForm />
  </Create>
);
