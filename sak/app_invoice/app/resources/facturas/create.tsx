"use client";

import { Create } from "@/components/create";
import { SimpleForm } from "@/components/simple-form";
import { FacturaFields } from "./form";

export const FacturaCreate = () => (
  <Create redirect="list" title="Crear Factura">
    <SimpleForm>
      <FacturaFields mode="create" />
    </SimpleForm>
  </Create>
);
