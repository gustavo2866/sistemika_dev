"use client";

import { ResourceEditWrapper } from "@/components/wrappers/resource-crud-wrapper";
import { itemFormConfig } from "./item-config";

const itemCRUDConfig = {
  entityName: "Item",
  entityNamePlural: "Items",
  form: itemFormConfig,
  editTitle: "Editar Item",
};

export const ItemEdit = () => (
  <ResourceEditWrapper config={itemCRUDConfig} />
);
