"use client";

import { Edit } from "@/components/edit";
import { SimpleForm } from "@/components/simple-form";
import { ItemFields } from "./form";

export const ItemEdit = () => (
  <Edit redirect="list" mutationMode="pessimistic" title="Editar Item">
    <SimpleForm>
      <ItemFields mode="edit" />
    </SimpleForm>
  </Edit>
);
