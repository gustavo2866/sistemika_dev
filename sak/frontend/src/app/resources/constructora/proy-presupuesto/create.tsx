"use client";

import { Create } from "@/components/create";
import { useLocation, useNavigate } from "react-router-dom";
import { ProyPresupuestoForm } from "./form";

export const ProyPresupuestoCreate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={false}
      title="Crear presupuesto de proyecto"
      mutationOptions={{
        onSuccess: () => {
          navigate(returnTo ?? "/proy-presupuestos", {
            replace: Boolean(returnTo),
          });
        },
      }}
    >
      <ProyPresupuestoForm />
    </Create>
  );
};
