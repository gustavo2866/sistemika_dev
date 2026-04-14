"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton, type SetupEditComponentProps } from "@/components/forms";
import { TipoContratoForm } from "./form";

export const TipoContratoEdit = ({
  embedded = false,
  id,
  redirect,
}: SetupEditComponentProps) => (
  <Edit
    id={id}
    redirect={redirect ?? "list"}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    title="Editar tipo de contrato"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <TipoContratoForm />
  </Edit>
);
