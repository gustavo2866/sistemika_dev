"use client";

import { Create, type CreateProps } from "@/components/create";
import { ErpEmpresaForm } from "./form";
import { normalizeErpEmpresaPayload } from "./model";

export const ErpEmpresaCreate = ({
  embedded = false,
  redirect,
}: {
  embedded?: boolean;
  redirect?: CreateProps["redirect"];
}) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear empresa ERP"
    className="w-full max-w-2xl"
    transform={normalizeErpEmpresaPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpEmpresaForm />
  </Create>
);
