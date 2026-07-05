"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ProyectoMacrorubroForm } from "./form";

export const ProyectoMacrorubroEdit = ({
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
    title="Editar macrorubro de proyecto"
    className="max-w-2xl w-full"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <ProyectoMacrorubroForm />
  </Edit>
);
