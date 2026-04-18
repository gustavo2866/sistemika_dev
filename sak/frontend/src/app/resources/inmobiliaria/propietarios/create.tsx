"use client";

import { Create } from "@/components/create";
import type { SetupCreateComponentProps } from "@/components/forms/form_order";
import { useLocation, useNavigate } from "react-router-dom";

import { PropietarioForm } from "./form";

export const PropietarioCreate = ({
  embedded = false,
  onCreated,
  redirect,
}: SetupCreateComponentProps & {
  onCreated?: (record: Record<string, unknown>) => void;
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
      title="Crear propietario"
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
          navigate("/propietarios");
        },
      }}
    >
      <PropietarioForm />
    </Create>
  );
};
