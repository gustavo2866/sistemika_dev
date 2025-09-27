"use client";

import { Create } from "@/components/create";
import { ProveedorForm } from "./form";

export const ProveedorCreate = () => (
  <Create redirect="list" title="Crear proveedor">
    <ProveedorForm />
  </Create>
);
