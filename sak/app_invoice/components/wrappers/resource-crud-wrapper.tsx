"use client";

import { Create } from "@/components/create";
import { Edit } from "@/components/edit";
import { SimpleForm } from "@/components/simple-form";
import { ResourceFormWrapper, ResourceFormConfig } from "./resource-form-wrapper";

export interface ResourceCRUDConfig {
  entityName: string;
  entityNamePlural: string;
  form: ResourceFormConfig;
  createTitle?: string;
  editTitle?: string;
}

export const ResourceCreateWrapper = ({ config }: { config: ResourceCRUDConfig }) => {
  return (
    <Create
      title={config.createTitle || `Crear ${config.entityName}`}
      redirect="list"
    >
      <SimpleForm>
        <ResourceFormWrapper config={config.form} />
      </SimpleForm>
    </Create>
  );
};

export const ResourceEditWrapper = ({ config }: { config: ResourceCRUDConfig }) => {
  return (
    <Edit
      title={config.editTitle || `Editar ${config.entityName}`}
      redirect="list"
      mutationMode="pessimistic"
    >
      <SimpleForm>
        <ResourceFormWrapper config={config.form} />
      </SimpleForm>
    </Edit>
  );
};
