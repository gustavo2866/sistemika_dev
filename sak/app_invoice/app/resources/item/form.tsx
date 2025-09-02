"use client";

import { ResourceFormWrapper } from "@/components/wrappers/resource-form-wrapper";
import { itemFormConfig } from "@/lib/item-config";

export const ItemForm = () => (
  <ResourceFormWrapper config={itemFormConfig} />
);
