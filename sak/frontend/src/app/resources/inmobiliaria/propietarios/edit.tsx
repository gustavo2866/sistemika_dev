"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { PropietarioForm } from "./form";

export const PropietarioEdit = () => (
  <Edit
    title="Editar propietario"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <PropietarioForm />
  </Edit>
);
