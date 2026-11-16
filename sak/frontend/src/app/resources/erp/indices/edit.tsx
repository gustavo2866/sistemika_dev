"use client";

import { Edit, type EditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpIndiceForm } from "./form";
import { normalizeErpIndicePayload } from "./model";

export const ErpIndiceEdit = ({
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
    title="Editar índice ERP"
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={normalizeErpIndicePayload}
    actions={<div className="flex justify-end"><FormOrderDeleteButton /></div>}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpIndiceForm />
  </Edit>
);
