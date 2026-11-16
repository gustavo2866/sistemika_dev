"use client";

import { Edit, type EditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpEmpresaForm } from "./form";
import { normalizeErpEmpresaPayload } from "./model";

export const ErpEmpresaEdit = ({
  embedded = false,
  id,
  redirect,
}: {
  embedded?: boolean;
  id?: EditProps["id"];
  redirect?: EditProps["redirect"];
}) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title="Editar empresa ERP"
    className="w-full max-w-2xl"
    mutationMode="pessimistic"
    transform={normalizeErpEmpresaPayload}
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpEmpresaForm />
  </Edit>
);
