"use client";

import { Create, type CreateProps } from "@/components/create";
import { ErpCashPeriodoForm } from "./form";
import { normalizeErpCashPeriodoPayload } from "./model";

export const ErpCashPeriodoCreate = ({
  embedded = false,
  redirect,
}: {
  embedded?: boolean;
  redirect?: CreateProps["redirect"];
}) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear período Cash"
    className="max-w-2xl w-full"
    transform={normalizeErpCashPeriodoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashPeriodoForm />
  </Create>
);
