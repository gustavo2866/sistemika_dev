"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ProyFaseForm } from "./form";

export const ProyFaseEdit = ({
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
    title="Editar fase de proyecto"
    className="max-w-2xl w-full"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <ProyFaseForm />
  </Edit>
);
