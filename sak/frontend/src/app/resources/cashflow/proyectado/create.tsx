"use client";

import { Create, type CreateProps } from "@/components/create";
import { ErpCashProyectadoForm } from "./form";
import { normalizeErpCashProyectadoPayload } from "./model";

export const ErpCashProyectadoCreate = ({
  embedded = false,
  redirect,
}: {
  embedded?: boolean;
  redirect?: CreateProps["redirect"];
}) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title="Crear proyectado Cash"
    className="max-w-2xl w-full"
    transform={normalizeErpCashProyectadoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpCashProyectadoForm />
  </Create>
);
