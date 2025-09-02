"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";

export const ItemShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <TextField source="name" />
      <TextField source="description" />
      <ReferenceField 
        source="user_id" 
        reference="users"
      >
        <TextField source="nombre" />
      </ReferenceField>
    </SimpleShowLayout>
  </Show>
);
