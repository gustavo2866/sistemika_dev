"use client";

import { Create } from "@/components/create";
import { ErpCashPendientesInputForm } from "./form";
import { normalizeErpCashPendientesInputPayload } from "./model";

export const ErpCashPendientesInputCreate = () => (
  <Create
    redirect="list"
    title="Crear pendiente Cash"
    className="w-full max-w-5xl"
    transform={normalizeErpCashPendientesInputPayload}
  >
    <ErpCashPendientesInputForm />
  </Create>
);
