"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { PoInvoiceStatusForm } from "./form";

export const PoInvoiceStatusEdit = () => (
  <Edit
    title="Editar estado de factura"
    className="max-w-2xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <PoInvoiceStatusForm />
  </Edit>
);
