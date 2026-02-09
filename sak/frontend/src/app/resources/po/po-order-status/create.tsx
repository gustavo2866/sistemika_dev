"use client";

import { Create } from "@/components/create";
import { PoOrderStatusForm } from "./form";

export const PoOrderStatusCreate = () => (
  <Create redirect="list" title="Crear estado de orden">
    <PoOrderStatusForm />
  </Create>
);
