"use client";

import { Edit } from "@/components/edit";
import { PoOrderStatusForm } from "./form";

export const PoOrderStatusEdit = () => (
  <Edit title="Editar estado de orden">
    <PoOrderStatusForm />
  </Edit>
);
