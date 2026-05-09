"use client";

import { Create } from "@/components/create";
import { NominaForm } from "./form";
import { normalizeNominaPayload } from "./model";

export const NominaCreate = () => (
  <Create
    redirect="list"
    title="Registrar empleado"
    transform={(data: any) => normalizeNominaPayload(data)}
  >
    <NominaForm />
  </Create>
);
