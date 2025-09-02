"use client";

import { Edit } from "@/components/edit";
import { SimpleForm } from "@/components/simple-form";
import { UserFields } from "./form";

export const UserEdit = () => (
  // si querés evitar undo, configurá aquí mutationMode
  <Edit redirect="list" mutationMode="pessimistic" title="Editar Usuario">
    <SimpleForm>
      <UserFields mode="edit" />
    </SimpleForm>
  </Edit>
);
