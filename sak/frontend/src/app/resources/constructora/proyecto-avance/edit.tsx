"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ProyectoAvanceForm } from "./form";
import { normalizeProyectoAvancePayload } from "./model";

export const ProyectoAvanceEdit = () => (
  <Edit
    title="Editar certificado"
    className="max-w-3xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
    transform={normalizeProyectoAvancePayload}
  >
    <ProyectoAvanceForm />
  </Edit>
);
