"use client";

import { Create } from "@/components/create";
import { CRMEventoForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { CalendarCheck } from "lucide-react";

const formatDateTimeInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const buildDefaultFechaEvento = () => {
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return formatDateTimeInput(next);
};

export const CRMEventoCreate = () => (
  <Create
    redirect="list"
    title={<ResourceTitle icon={CalendarCheck} text="Crear Evento CRM" />}
  >
    <CRMEventoForm
      defaultValues={{
        fecha_evento: buildDefaultFechaEvento(),
      }}
    />
  </Create>
);
