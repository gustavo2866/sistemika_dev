"use client";

import { Edit } from "@/components/edit";
import { CRMEventoForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { CalendarCheck } from "lucide-react";

export const CRMEventoEdit = () => (
  <Edit title={<ResourceTitle icon={CalendarCheck} text="Editar Evento CRM" />}>
    <CRMEventoForm />
  </Edit>
);
