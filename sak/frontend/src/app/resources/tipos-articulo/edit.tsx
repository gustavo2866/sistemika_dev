"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { TipoArticuloForm } from "./form";

export const TipoArticuloEdit = () => (
  <Edit
    title="Editar tipo de articulo"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <TipoArticuloForm />
  </Edit>
);
