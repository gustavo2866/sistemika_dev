"use client";

import { Create } from "@/components/create";
import { ProyectoAvanceForm } from "./form";
import { normalizeProyectoAvancePayload } from "./model";

export const ProyectoAvanceCreate = () => (
  <Create
    redirect="list"
    title="Crear certificado"
    className="max-w-3xl w-full"
    transform={normalizeProyectoAvancePayload}
  >
    <ProyectoAvanceForm />
  </Create>
);
