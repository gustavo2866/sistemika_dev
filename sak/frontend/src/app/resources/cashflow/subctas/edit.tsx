"use client";

import { Edit, type EditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpCashSubctaForm } from "./form";
import { normalizeErpCashSubctaPayload } from "./model";

export const ErpCashSubctaEdit = ({ embedded = false, id, redirect }: { embedded?: boolean; id?: EditProps["id"]; redirect?: EditProps["redirect"] }) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title="Editar subcuenta Cash"
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={normalizeErpCashSubctaPayload}
    actions={<div className="flex justify-end"><FormOrderDeleteButton /></div>}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashSubctaForm />
  </Edit>
);
