"use client";

import { Create, type CreateProps } from "@/components/create";
import { ErpCashSubctaForm } from "./form";
import { normalizeErpCashSubctaPayload } from "./model";

export const ErpCashSubctaCreate = ({ embedded = false, redirect }: { embedded?: boolean; redirect?: CreateProps["redirect"] }) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear subcuenta Cash"
    className="max-w-2xl w-full"
    transform={normalizeErpCashSubctaPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashSubctaForm />
  </Create>
);
