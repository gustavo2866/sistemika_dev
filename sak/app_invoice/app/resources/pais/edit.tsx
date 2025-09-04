"use client";

import { Edit } from "@/components/edit";
import { SimpleForm } from "@/components/simple-form";
import { PaisFields } from "./form";

export const PaisEdit = () => (
  <Edit redirect="list" mutationMode="pessimistic" title="Editar Pais">
    <SimpleForm>
      <PaisFields mode="edit" />
    </SimpleForm>
  </Edit>
);
