"use client";

import { Edit, type EditProps } from "@/components/edit";
import { CashCuentaDeleteButton } from "./delete-button";
import { ErpCashCuentaForm } from "./form";
import { normalizeErpCashCuentaPayload } from "./model";

export const ErpCashCuentaEdit = ({ embedded = false, id, redirect }: { embedded?: boolean; id?: EditProps["id"]; redirect?: EditProps["redirect"] }) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title="Editar cuenta Cash"
    className="max-w-none w-full"
    contentClassName="max-w-none"
    mutationMode="pessimistic"
    transform={normalizeErpCashCuentaPayload}
    actions={<div className="flex justify-end"><CashCuentaDeleteButton redirect={redirect ?? "/cashflow/setup/cuentas"} /></div>}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashCuentaForm />
  </Edit>
);
