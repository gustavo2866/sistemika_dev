"use client";

import { ResourceListWrapper } from "@/components/wrappers/resource-list-wrapper";
import { itemListConfig } from "./item-config";

export const ItemList = () => (
  <ResourceListWrapper config={itemListConfig} />
);
