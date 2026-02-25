"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { TipoActualizacionForm } from "./form";

export const TipoActualizacionEdit = () => (
  <Edit
    title="Editar tipo de actualizacion"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <TipoActualizacionForm />
  </Edit>
);
