"use client";

import { useLocation, useNavigate } from "react-router-dom";

import { Create } from "@/components/create";
import { ErpPresupuestoForm } from "./form";
import { normalizeErpPresupuestoPayload } from "./model";

export const ErpPresupuestoCreate = ({
  embedded = false,
  redirect = "list",
}: {
  embedded?: boolean;
  redirect?: string | false;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={returnTo ? false : redirect}
      title="Crear presupuesto ERP"
      transform={normalizeErpPresupuestoPayload}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={{
        onSuccess: () => {
          navigate(returnTo ?? "/erp/presupuestos", {
            replace: true,
          });
        },
      }}
    >
      <ErpPresupuestoForm />
    </Create>
  );
};
