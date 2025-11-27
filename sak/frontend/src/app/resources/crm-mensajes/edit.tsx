"use client";

import { Edit } from "@/components/edit";
import { CRMMensajeForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { Mail } from "lucide-react";

export const CRMMensajeEdit = () => (
  <Edit title={<ResourceTitle icon={Mail} text="Editar mensaje CRM" />}>
    <CRMMensajeForm />
  </Edit>
);
