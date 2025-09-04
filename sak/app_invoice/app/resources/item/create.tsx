"use client";

import { Create } from "@/components/create";
import { SimpleForm } from "@/components/simple-form";
import { ItemFields } from "./form";

export const ItemCreate = () => (
  <Create redirect="list" title="Crear Item">
    <SimpleForm>
      <ItemFields mode="create" />
    </SimpleForm>
  </Create>
);
