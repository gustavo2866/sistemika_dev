"use client";

import { Create } from "@/components/create";
import { PoOrderForm } from "./form";
import { normalizePoOrderPayload } from "./model";

export const PoOrderCreate = () => (
  <Create
    redirect="list"
    title="Crear Orden"
    transform={(data: any) => normalizePoOrderPayload(data)}
  >
    <PoOrderForm />
  </Create>
);
