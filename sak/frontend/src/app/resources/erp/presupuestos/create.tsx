"use client";

import { useLocation, useNavigate } from "react-router-dom";

import { Create } from "@/components/create";
import { ErpPresupuestoForm } from "./form";
import {
  normalizeErpPresupuestoPayload,
  type ErpPresupuestoFormValues,
} from "./model";

export const ErpPresupuestoCreate = ({
  embedded = false,
  redirect = "list",
  initialValues,
  onCancel,
  onSaved,
}: {
  embedded?: boolean;
  redirect?: string | false;
  initialValues?: Partial<ErpPresupuestoFormValues>;
  onCancel?: () => void;
  onSaved?: () => void;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={returnTo || onSaved ? false : redirect}
      title="Crear presupuesto ERP"
      transform={normalizeErpPresupuestoPayload}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={{
        onSuccess: () => {
          if (onSaved) {
            onSaved();
            return;
          }
          navigate(returnTo ?? "/erp/presupuestos", {
            replace: true,
          });
        },
      }}
    >
      <ErpPresupuestoForm initialValues={initialValues} onCancel={onCancel} />
    </Create>
  );
};
