"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ProyectoConceptoForm } from "./form";

export const ProyectoConceptoEdit = ({
  embedded = false,
  id,
  redirect,
}: {
  embedded?: boolean;
  id?: string | number;
  redirect?: string | false;
}) => (
  <Edit
    id={id}
    redirect={redirect}
    title="Editar concepto de proyecto"
    className="max-w-2xl w-full"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <ProyectoConceptoForm />
  </Edit>
);
