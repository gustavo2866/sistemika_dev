"use client";

import { Create } from "@/components/create";
import { SimpleForm } from "@/components/simple-form";
import { TipoOperacionFields } from "./form";

export const TipoOperacionCreate = () => (
  <Create redirect="list" title="Crear Tipo de Operación">
    <SimpleForm>
      <TipoOperacionFields mode="create" />
    </SimpleForm>
  </Create>
);
