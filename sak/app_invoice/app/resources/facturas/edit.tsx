"use client";

import { Edit } from "@/components/edit";
import { SimpleForm } from "@/components/simple-form";
import { FacturaFields } from "./form";

export const FacturaEdit = () => (
  <Edit title="Editar Factura">
    <SimpleForm>
      <FacturaFields mode="edit" />
    </SimpleForm>
  </Edit>
);
