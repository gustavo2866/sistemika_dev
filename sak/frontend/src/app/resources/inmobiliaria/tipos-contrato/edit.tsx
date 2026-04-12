"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { TipoContratoForm } from "./form";

export const TipoContratoEdit = () => (
  <Edit
    title="Editar tipo de contrato"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <TipoContratoForm />
  </Edit>
);
