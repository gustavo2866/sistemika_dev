"use client";

import { ResourceCreateWrapper } from "@/components/wrappers/resource-crud-wrapper";
import { itemFormConfig } from "./item-config";

const itemCRUDConfig = {
  entityName: "Item",
  entityNamePlural: "Items",
  form: itemFormConfig,
  createTitle: "Crear Item",
};

export const ItemCreate = () => (
  <ResourceCreateWrapper config={itemCRUDConfig} />
);
