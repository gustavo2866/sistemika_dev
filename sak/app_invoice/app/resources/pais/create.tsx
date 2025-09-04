"use client";

import { Create } from "@/components/create";
import { SimpleForm } from "@/components/simple-form";
import { PaisFields } from "./form";

export const PaisCreate = () => (
  <Create redirect="list" title="Crear Pais">
    <SimpleForm>
      <PaisFields mode="create" />
    </SimpleForm>
  </Create>
);
