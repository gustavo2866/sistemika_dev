"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { CRMCelularForm } from "./form";

export const CRMCelularEdit = () => (
  <Edit
    title="Editar celular CRM"
    className="max-w-2xl w-full"
    actions={(
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    )}
  >
    <CRMCelularForm />
  </Edit>
);

