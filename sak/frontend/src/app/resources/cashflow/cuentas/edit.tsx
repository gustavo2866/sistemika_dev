"use client";

import { Edit, type EditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpCashCuentaForm } from "./form";
import { normalizeErpCashCuentaPayload } from "./model";

export const ErpCashCuentaEdit = ({ embedded = false, id, redirect }: { embedded?: boolean; id?: EditProps["id"]; redirect?: EditProps["redirect"] }) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title="Editar cuenta Cash"
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={normalizeErpCashCuentaPayload}
    actions={<div className="flex justify-end"><FormOrderDeleteButton /></div>}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashCuentaForm />
  </Edit>
);
