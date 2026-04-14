"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton, type SetupEditComponentProps } from "@/components/forms";
import { TipoActualizacionForm } from "./form";

export const TipoActualizacionEdit = ({
  embedded = false,
  id,
  redirect,
}: SetupEditComponentProps) => (
  <Edit
    id={id}
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
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
