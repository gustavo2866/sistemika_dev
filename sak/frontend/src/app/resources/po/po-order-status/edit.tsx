"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { PoOrderStatusForm } from "./form";

export const PoOrderStatusEdit = () => (
  <Edit
    title="Editar estado de orden"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <PoOrderStatusForm />
  </Edit>
);
