"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { ReferenceField } from "@/components/reference-field";
import { AvatarCell } from "@/components/cells/avatar-cell";

export const UserShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" />
      <AvatarCell nameSource="nombre" urlSource="url_foto" />
      <TextField source="nombre" />
      <TextField source="email" />
      <TextField source="telefono" />
      <ReferenceField 
        source="pais_id" 
        reference="paises"
      >
        <TextField source="name" />
      </ReferenceField>
    </SimpleShowLayout>
  </Show>
);
