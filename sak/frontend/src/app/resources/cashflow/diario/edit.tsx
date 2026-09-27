"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpCashDiarioForm } from "./form";
import { normalizeErpCashDiarioPayload } from "./model";

export const ErpCashDiarioEdit = () => (
  <Edit
    redirect="list"
    title="Editar movimiento del Diario Cash"
    className="max-w-5xl w-full"
    mutationMode="pessimistic"
    transform={normalizeErpCashDiarioPayload}
    actions={<div className="flex justify-end"><FormOrderDeleteButton /></div>}
  >
    <ErpCashDiarioForm />
  </Edit>
);
