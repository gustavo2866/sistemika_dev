"use client";

import { Edit } from "@/components/edit";
import { SimpleForm } from "@/components/simple-form";
import { TipoOperacionFields } from "./form";

export const TipoOperacionEdit = () => (
  <Edit title="Editar Tipo de Operación">
    <SimpleForm>
      <TipoOperacionFields mode="edit" />
    </SimpleForm>
  </Edit>
);
