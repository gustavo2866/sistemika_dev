"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpCashPendientesInputForm } from "./form";
import { normalizeErpCashPendientesInputPayload } from "./model";

export const ErpCashPendientesInputEdit = () => (
  <Edit
    redirect="list"
    title="Editar pendiente Cash"
    className="w-full max-w-5xl"
    mutationMode="pessimistic"
    transform={normalizeErpCashPendientesInputPayload}
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <ErpCashPendientesInputForm />
  </Edit>
);
