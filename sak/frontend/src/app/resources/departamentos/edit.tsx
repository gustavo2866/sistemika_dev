"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { DepartamentoForm } from "./form";

export const DepartamentoEdit = () => (
  <Edit
    title="Editar departamento"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <DepartamentoForm />
  </Edit>
);
