"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ProyFaseForm } from "./form";

export const ProyFaseEdit = () => (
  <Edit
    title="Editar fase de proyecto"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <ProyFaseForm />
  </Edit>
);
