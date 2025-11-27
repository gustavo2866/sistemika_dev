"use client";

import { Create } from "@/components/create";
import { CRMOportunidadForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { Target } from "lucide-react";

export const CRMOportunidadCreate = () => (
  <Create
    redirect="list"
    title={<ResourceTitle icon={Target} text="Crear Oportunidad CRM" />}
  >
    <CRMOportunidadForm />
  </Create>
);
