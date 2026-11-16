"use client";

import { Create, type CreateProps } from "@/components/create";
import { ErpCuentaTipoForm } from "./form";
import { normalizeErpCuentaTipoPayload } from "./model";


export const ErpCuentaTipoCreate = ({
  embedded = false,
  redirect,
}: {
  embedded?: boolean;
  redirect?: CreateProps["redirect"];
}) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear tipo de cuenta ERP"
    className="max-w-2xl w-full"
    transform={normalizeErpCuentaTipoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCuentaTipoForm />
  </Create>
);
