"use client";

import { Edit, type EditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpCashPeriodoForm } from "./form";
import { normalizeErpCashPeriodoPayload } from "./model";

export const ErpCashPeriodoEdit = ({
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
    title="Editar período Cash"
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={normalizeErpCashPeriodoPayload}
    actions={<div className="flex justify-end"><FormOrderDeleteButton /></div>}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashPeriodoForm />
  </Edit>
);
