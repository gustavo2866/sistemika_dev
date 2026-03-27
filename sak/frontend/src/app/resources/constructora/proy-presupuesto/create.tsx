"use client";

import { Create } from "@/components/create";
import { ProyPresupuestoForm } from "./form";

export const ProyPresupuestoCreate = () => (
  <Create redirect="list" title="Crear presupuesto de proyecto">
    <ProyPresupuestoForm />
  </Create>
);
