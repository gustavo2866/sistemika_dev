"use client";

import { Create } from "@/components/create";
import { SimpleForm } from "@/components/simple-form";
import { UserFields } from "./form";

export const UserCreate = () => (
  <Create redirect="list" title="Crear Usuario">
    <SimpleForm>
      <UserFields mode="create" />
    </SimpleForm>
  </Create>
);
