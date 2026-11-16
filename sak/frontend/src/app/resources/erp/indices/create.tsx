"use client";

import { Create, type CreateProps } from "@/components/create";
import { ErpIndiceForm } from "./form";
import { normalizeErpIndicePayload } from "./model";

export const ErpIndiceCreate = ({
  embedded = false,
  redirect,
}: {
  embedded?: boolean;
  redirect?: CreateProps["redirect"];
}) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear índice ERP"
    className="max-w-2xl w-full"
    transform={normalizeErpIndicePayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpIndiceForm />
  </Create>
);
