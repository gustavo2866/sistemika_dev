"use client";

import { useLocation, useNavigate } from "react-router-dom";

import { Create } from "@/components/create";
import { ProyectosBudgetForm } from "./form";

export const ProyectosBudgetCreate = ({
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
      title="Crear budget de proyecto"
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={{
        onSuccess: () => {
          navigate(returnTo ?? "/constructora/proyectos-budget", {
            replace: true,
          });
        },
      }}
    >
      <ProyectosBudgetForm />
    </Create>
  );
};
