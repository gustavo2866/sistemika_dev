"use client";

import { Create, type CreateProps } from "@/components/create";
import { ErpCashMapForm } from "./form";
import { normalizeErpCashMapPayload } from "./model";

export const ErpCashMapCreate = ({ embedded = false, redirect }: { embedded?: boolean; redirect?: CreateProps["redirect"] }) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear mapeo Cash"
    className="max-w-2xl w-full"
    transform={normalizeErpCashMapPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashMapForm />
  </Create>
);
