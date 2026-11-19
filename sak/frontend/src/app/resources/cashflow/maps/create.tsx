"use client";

import { Create, type CreateProps } from "@/components/create";
import { useNotify } from "ra-core";
import { ErpCashMapForm } from "./form";
import { normalizeErpCashMapPayload, type ErpCashMapFormValues } from "./model";

export const ErpCashMapCreate = ({ embedded = false, redirect, initialValues, onCancel, onSaved }: {
  embedded?: boolean;
  redirect?: CreateProps["redirect"];
  initialValues?: Partial<ErpCashMapFormValues>;
  onCancel?: () => void;
  onSaved?: () => void;
}) => {
  const notify = useNotify();
  return (
    <Create
      redirect={onSaved ? false : redirect ?? (embedded ? false : "list")}
      title="Crear mapeo Cash"
      className="max-w-2xl w-full"
      transform={normalizeErpCashMapPayload}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={onSaved ? { onSuccess: () => { notify("Mapeo guardado", { type: "success" }); onSaved(); } } : undefined}
    >
      <ErpCashMapForm initialValues={initialValues} onCancel={onCancel} />
    </Create>
  );
};
