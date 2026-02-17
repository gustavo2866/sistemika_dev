"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { PoInvoiceStatusFinForm } from "./form";

export const PoInvoiceStatusFinEdit = () => (
  <Edit
    title="Editar estado financiero de factura"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <PoInvoiceStatusFinForm />
  </Edit>
);
