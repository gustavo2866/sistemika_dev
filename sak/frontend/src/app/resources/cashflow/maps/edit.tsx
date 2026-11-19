"use client";

import { Edit, type EditProps } from "@/components/edit";
import { useNotify } from "ra-core";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpCashMapForm } from "./form";
import { normalizeErpCashMapPayload } from "./model";

export const ErpCashMapEdit = ({ embedded = false, id, redirect, onCancel, onSaved }: {
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
      title="Editar mapeo Cash"
      className="max-w-2xl w-full"
      mutationMode="pessimistic"
      transform={normalizeErpCashMapPayload}
      actions={<div className="flex justify-end"><FormOrderDeleteButton /></div>}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={onSaved ? { onSuccess: () => { notify("Mapeo guardado", { type: "success" }); onSaved(); } } : undefined}
    >
      <ErpCashMapForm onCancel={onCancel} />
    </Edit>
  );
};
