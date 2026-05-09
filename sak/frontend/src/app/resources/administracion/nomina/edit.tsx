"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { NominaForm } from "./form";
import { normalizeNominaPayload } from "./model";

export const NominaEdit = () => (
  <Edit
    title="Editar empleado"
    mutationMode="pessimistic"
    transform={(data: any) => normalizeNominaPayload(data)}
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <NominaForm />
  </Edit>
);
