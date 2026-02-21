"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { PropiedadesStatusForm } from "./form";

export const PropiedadesStatusEdit = () => (
  <Edit
    title="Editar estado de propiedad"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <PropiedadesStatusForm />
  </Edit>
);
