"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { ResourceTitle } from "@/components/resource-title";
import { Building } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { EmprendimientoForm } from "./form";

export const EmprendimientoCreate = ({
  embedded = false,
  onCreated,
  onCancel,
  redirect,
}: SetupCreateComponentProps & {
  onCreated?: (record: Record<string, unknown>) => void;
  onCancel?: () => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={false}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      title={<ResourceTitle icon={Building} text="Crear emprendimiento" />}
      mutationOptions={{
        onSuccess: (data) => {
          if (onCreated) {
            onCreated((data as Record<string, unknown>) ?? {});
            return;
          }
          if (returnTo) {
            navigate(returnTo);
            return;
          }
          if (typeof redirect === "string") {
            navigate(redirect);
            return;
          }
          navigate("/emprendimientos");
        },
      }}
    >
      <EmprendimientoForm onCancel={embedded ? onCancel : undefined} />
    </Create>
  );
};
