"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton, type SetupEditComponentProps } from "@/components/forms";
import { PropiedadesStatusForm } from "./form";

export const PropiedadesStatusEdit = ({
  embedded = false,
  id,
  redirect,
}: SetupEditComponentProps) => (
  <Edit
    id={id}
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
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
