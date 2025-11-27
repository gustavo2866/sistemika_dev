"use client";

import { Create } from "@/components/create";
import { CRMContactoForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { UserRound } from "lucide-react";

export const CRMContactoCreate = () => (
  <Create
    redirect="list"
    title={<ResourceTitle icon={UserRound} text="Crear Contacto CRM" />}
  >
    <CRMContactoForm />
  </Create>
);
