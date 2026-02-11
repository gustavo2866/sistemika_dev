"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ArticuloForm } from "./form";

export const ArticuloEdit = () => (
  <Edit
    title="Editar articulo"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <ArticuloForm />
  </Edit>
);
