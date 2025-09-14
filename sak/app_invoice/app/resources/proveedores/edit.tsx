"use client";

import { Edit } from "@/components/edit";
import { SimpleForm } from "@/components/simple-form";
import { ProveedorFields } from "./form";

export const ProveedorEdit = () => (
  <Edit title="Editar Proveedor">
    <SimpleForm>
      <ProveedorFields mode="edit" />
    </SimpleForm>
  </Edit>
);
