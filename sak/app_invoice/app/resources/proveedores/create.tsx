"use client";

import { Create } from "@/components/create";
import { SimpleForm } from "@/components/simple-form";
import { ProveedorFields } from "./form";

export const ProveedorCreate = () => (
  <Create redirect="list" title="Crear Proveedor">
    <SimpleForm>
      <ProveedorFields mode="create" />
    </SimpleForm>
  </Create>
);
