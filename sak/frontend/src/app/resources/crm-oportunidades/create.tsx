"use client";

import { Create } from "@/components/create";
import { CRMOportunidadForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { Target } from "lucide-react";
import { useLocation } from "react-router";

export const CRMOportunidadCreate = () => {
  const location = useLocation();
  const fromPanel = Boolean((location.state as { fromPanel?: boolean } | null)?.fromPanel);

  const FormComponent = CRMOportunidadForm;

  return (
    <Create
      redirect={fromPanel ? "/crm/panel" : "list"}
      title={<ResourceTitle icon={Target} text="Crear Oportunidad CRM" />}
    >
      <FormComponent />
    </Create>
  );
};
