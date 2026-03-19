"use client";

import { Edit } from "@/components/edit";
import { UserForm } from "./form";

export const UserEdit = () => (
  <Edit redirect="list" mutationMode="pessimistic" title="Editar Usuario">
    <UserForm />
  </Edit>
);