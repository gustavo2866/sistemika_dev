"use client";

import { Edit } from "@/components/edit";
import { CRMContactoForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { UserRound } from "lucide-react";

export const CRMContactoEdit = () => (
  <Edit title={<ResourceTitle icon={UserRound} text="Editar Contacto CRM" />}>
    <CRMContactoForm />
  </Edit>
);
