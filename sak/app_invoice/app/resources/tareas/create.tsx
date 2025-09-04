"use client";

import { Create } from "@/components/create";
import { SimpleForm } from "@/components/simple-form";
import { TareaFields } from "./form";

export const TareaCreate = () => (
  <Create redirect="list" title="Crear Tarea">
    <SimpleForm>
      <TareaFields mode="create" />
    </SimpleForm>
  </Create>
);
