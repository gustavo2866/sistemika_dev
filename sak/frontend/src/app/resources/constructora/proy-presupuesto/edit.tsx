"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ProyPresupuestoForm } from "./form";

export const ProyPresupuestoEdit = () => (
  <Edit
    title="Editar presupuesto de proyecto"
    className="max-w-3xl w-full"
    actions={
      <div className="flex justify-end">
        <FormOrderDeleteButton />
      </div>
    }
  >
    <ProyPresupuestoForm />
  </Edit>
);
