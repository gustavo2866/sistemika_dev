"use client";

import { Create, type CreateProps } from "@/components/create";
import { ErpCashCuentaForm } from "./form";
import { normalizeErpCashCuentaPayload } from "./model";

export const ErpCashCuentaCreate = ({ embedded = false, redirect }: { embedded?: boolean; redirect?: CreateProps["redirect"] }) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear cuenta Cash"
    className="max-w-2xl w-full"
    transform={normalizeErpCashCuentaPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashCuentaForm />
  </Create>
);
