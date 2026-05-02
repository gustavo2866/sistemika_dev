"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { useLocation, useNavigate } from "react-router-dom";
import { ProyPresupuestoForm } from "./form";

export const ProyPresupuestoEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Edit
      redirect={false}
      mutationMode="pessimistic"
      title="Editar presupuesto de proyecto"
      className="max-w-3xl w-full"
      mutationOptions={{
        onSuccess: () => {
          navigate(returnTo ?? "/proy-presupuestos", {
            replace: Boolean(returnTo),
          });
        },
      }}
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
