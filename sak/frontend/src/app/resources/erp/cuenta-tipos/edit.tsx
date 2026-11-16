"use client";

import { Edit, type EditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpCuentaTipoForm } from "./form";
import { normalizeErpCuentaTipoPayload } from "./model";


export const ErpCuentaTipoEdit = ({
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
    title="Editar tipo de cuenta ERP"
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={normalizeErpCuentaTipoPayload}
    actions={<div className="flex justify-end"><FormOrderDeleteButton /></div>}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCuentaTipoForm />
  </Edit>
);
