"use client";

import { Create } from "@/components/create";
import { NominaForm } from "./form";

export const NominaCreate = () => (
  <Create redirect="list" title="Registrar Empleado">
    <NominaForm />
  </Create>
);
