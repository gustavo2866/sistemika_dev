"use client";

import { Edit, type EditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpCashMapForm } from "./form";
import { normalizeErpCashMapPayload } from "./model";

export const ErpCashMapEdit = ({ embedded = false, id, redirect }: { embedded?: boolean; id?: EditProps["id"]; redirect?: EditProps["redirect"] }) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title="Editar mapeo Cash"
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={normalizeErpCashMapPayload}
    actions={<div className="flex justify-end"><FormOrderDeleteButton /></div>}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashMapForm />
  </Edit>
);
