"use client";

import { Create } from "@/components/create";
import { ProyectoEncargadoForm } from "./form";
import { normalizeProyectoEncargadoPayload } from "./model";

export const ProyectoEncargadoCreate = () => (
  <Create
    title="Crear encargado de proyecto"
    className="max-w-3xl w-full"
    transform={(data: any) => normalizeProyectoEncargadoPayload(data)}
  >
    <ProyectoEncargadoForm />
  </Create>
);
