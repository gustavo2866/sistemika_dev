"use client";

import { Edit } from "@/components/edit";
import { CRMOportunidadForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { Target } from "lucide-react";

export const CRMOportunidadEdit = () => (
  <Edit title={<ResourceTitle icon={Target} text="Editar Oportunidad CRM" />}>
    <CRMOportunidadForm />
  </Edit>
);
