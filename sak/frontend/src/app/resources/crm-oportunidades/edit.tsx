"use client";

import { Edit } from "@/components/edit";
import { CRMOportunidadForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { Target } from "lucide-react";
import { useLocation } from "react-router";

export const CRMOportunidadEdit = () => {
  const location = useLocation();
  const fromPanel = Boolean((location.state as { fromPanel?: boolean } | null)?.fromPanel);

  return (
    <Edit
      title={<ResourceTitle icon={Target} text="Editar Oportunidad CRM" />}
      redirect={fromPanel ? "/crm/panel" : "list"}
    >
      <CRMOportunidadForm />
    </Edit>
  );
};
