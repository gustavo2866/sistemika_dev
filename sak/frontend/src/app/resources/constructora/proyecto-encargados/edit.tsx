"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ProyectoEncargadoForm } from "./form";
import { normalizeProyectoEncargadoPayload } from "./model";

const ProyectoEncargadoEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const ProyectoEncargadoEdit = () => (
  <Edit
    title="Editar encargado de proyecto"
    className="max-w-3xl w-full"
    mutationMode="pessimistic"
    transform={(data: any) => normalizeProyectoEncargadoPayload(data)}
    actions={<ProyectoEncargadoEditActions />}
  >
    <ProyectoEncargadoForm />
  </Edit>
);
