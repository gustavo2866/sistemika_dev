"use client";

import { useLocation, useNavigate } from "react-router-dom";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { ErpPresupuestoForm } from "./form";
import { normalizeErpPresupuestoPayload } from "./model";

export const ErpPresupuestoEdit = ({
  embedded = false,
  id,
  redirect,
}: {
  embedded?: boolean;
  id?: string | number;
  redirect?: string | false;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Edit
      id={id}
      redirect={returnTo ? false : redirect}
      title="Editar presupuesto ERP"
      className="max-w-3xl w-full"
      transform={normalizeErpPresupuestoPayload}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      actions={
        <div className="flex justify-end">
          <FormOrderDeleteButton />
        </div>
      }
      mutationOptions={{
        onSuccess: () => {
          navigate(returnTo ?? "/erp/presupuestos", {
            replace: true,
          });
        },
      }}
    >
      <ErpPresupuestoForm />
    </Edit>
  );
};
