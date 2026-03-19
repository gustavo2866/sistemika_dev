"use client";

import { Create } from "@/components/create";
import { CentroCostoForm } from "./form";

export const CentroCostoCreate = () => (
  <Create redirect="list" title="Nuevo centro de costo">
    <CentroCostoForm />
  </Create>
);
