"use client";

import { Edit } from "@/components/edit";
import { SimpleForm } from "@/components/simple-form";
import { TareaFields } from "./form";

export const TareaEdit = () => (
  <Edit>
    <SimpleForm>
      <TareaFields mode="edit" />
    </SimpleForm>
  </Edit>
);
