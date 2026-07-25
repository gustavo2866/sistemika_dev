"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { ErpCuentaForm } from "./form";
import { normalizeErpCuentaPayload } from "./model";

type ErpCuentaCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

export const ErpCuentaCreate = ({
  embedded = false,
  redirect,
}: ErpCuentaCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear cuenta ERP"
    className="max-w-2xl w-full"
    transform={normalizeErpCuentaPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCuentaForm />
  </Create>
);
