"use client";

import { Edit, type EditProps } from "@/components/edit";
import { useNotify } from "ra-core";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpCashSubctaForm } from "./form";
import { normalizeErpCashSubctaPayload } from "./model";

export const ErpCashSubctaEdit = ({ embedded = false, id, redirect, onCancel, onSaved }: {
  embedded?: boolean;
  id?: EditProps["id"];
  redirect?: EditProps["redirect"];
  onCancel?: () => void;
  onSaved?: () => void;
}) => {
  const notify = useNotify();
  return (
  <Edit
    id={id}
    redirect={onSaved ? false : redirect ?? (embedded ? false : "list")}
    title="Editar subcuenta Cash"
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={normalizeErpCashSubctaPayload}
    actions={onSaved ? false : <div className="flex justify-end"><FormOrderDeleteButton /></div>}
    mutationOptions={onSaved ? { onSuccess: () => { notify("Subcuenta guardada", { type: "success" }); onSaved(); } } : undefined}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashSubctaForm onCancel={onCancel} />
  </Edit>
  );
};
