"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { TipoSolicitudForm } from "./form";

export const TipoSolicitudEdit = () => (
  <Edit
    title="Editar tipo de solicitud"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <TipoSolicitudForm />
  </Edit>
);
