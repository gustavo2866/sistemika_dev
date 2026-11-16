"use client";

import { Create } from "@/components/create";
import { useLocation } from "react-router-dom";
import { ProyPresupuestoForm } from "./form";

export const ProyPresupuestoCreate = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  return (
    <Create
      redirect={returnTo ?? "list"}
      title="Crear presupuesto de proyecto"
    >
      <ProyPresupuestoForm />
    </Create>
  );
};
