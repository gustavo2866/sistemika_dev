"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { useLocation } from "react-router-dom";
import { ProyPresupuestoForm } from "./form";

export const ProyPresupuestoEdit = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Edit
      redirect={returnTo ?? "list"}
      mutationMode="pessimistic"
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
};
