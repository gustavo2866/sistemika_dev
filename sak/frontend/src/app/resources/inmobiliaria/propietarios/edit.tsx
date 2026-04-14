"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton, type SetupEditComponentProps } from "@/components/forms";
import { PropietarioForm } from "./form";

export const PropietarioEdit = ({
  embedded = false,
  id,
  redirect,
}: SetupEditComponentProps) => (
  <Edit
    id={id}
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
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
