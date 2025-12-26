"use client";

import { Edit } from "@/components/edit";
import { CRMOportunidadForm } from "./form";
import { useLocation } from "react-router";

export const CRMOportunidadEdit = () => {
  const location = useLocation();
  const fromPanel = Boolean((location.state as { fromPanel?: boolean } | null)?.fromPanel);

  return (
    <Edit
      redirect={fromPanel ? "/crm/panel" : "list"}
    >
      <CRMOportunidadForm />
    </Edit>
  );
};
