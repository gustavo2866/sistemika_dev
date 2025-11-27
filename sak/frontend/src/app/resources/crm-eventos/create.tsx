"use client";

import { Create } from "@/components/create";
import { CRMEventoForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { CalendarCheck } from "lucide-react";

export const CRMEventoCreate = () => (
  <Create
    redirect="list"
    title={<ResourceTitle icon={CalendarCheck} text="Crear Evento CRM" />}
  >
    <CRMEventoForm />
  </Create>
);
