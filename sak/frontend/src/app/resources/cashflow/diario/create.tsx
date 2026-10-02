"use client";

import { Create } from "@/components/create";
import { ErpCashDiarioForm } from "./form";
import { normalizeErpCashDiarioPayload } from "./model";

export const ErpCashDiarioCreate = () => (
  <Create
    redirect="list"
    title="Crear movimiento del Diario Cash"
    className="max-w-5xl w-full"
    transform={normalizeErpCashDiarioPayload}
  >
    <ErpCashDiarioForm />
  </Create>
);
