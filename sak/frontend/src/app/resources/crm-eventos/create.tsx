"use client";

import { Create } from "@/components/create";
import { CRMEventoForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { CalendarCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

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

export const CRMEventoCreate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    oportunidad_id?: number | string;
    contacto_id?: number | string;
  } | null;
  const oportunidadId = state?.oportunidad_id;
  const contactoId = state?.contacto_id;

  return (
    <Create
      redirect={false}
      mutationOptions={{
        onSuccess: () => {
          navigate(-1);
        },
      }}
      title={<ResourceTitle icon={CalendarCheck} text="Crear Evento CRM" />}
    >
      <CRMEventoForm
        defaultValues={{
          fecha_evento: buildDefaultFechaEvento(),
          ...(oportunidadId ? { oportunidad_id: Number(oportunidadId) } : {}),
          ...(contactoId ? { contacto_id: Number(contactoId) } : {}),
        }}
      />
    </Create>
  );
};
