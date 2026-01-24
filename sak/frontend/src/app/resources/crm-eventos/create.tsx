"use client";

import { Create } from "@/components/create";
import { CRMEventoForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { CalendarCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useGetIdentity } from "ra-core";

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
  const { data: identity } = useGetIdentity();
  const { oportunidadId, contactoId } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const rawFilter = params.get("filter");
    if (rawFilter) {
      try {
        const parsed = JSON.parse(rawFilter);
        return {
          oportunidadId: parsed?.oportunidad_id,
          contactoId: parsed?.contacto_id,
        };
      } catch {
        // ignore invalid filter param
      }
    }
    return {
      oportunidadId: params.get("oportunidad_id"),
      contactoId: params.get("contacto_id"),
    };
  }, [location.search]);
  const lockedOportunidadId = (() => {
    const numeric = Number(oportunidadId);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  })();

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
          ...(identity?.id ? { asignado_a_id: Number(identity.id) } : {}),
          ...(oportunidadId ? { oportunidad_id: Number(oportunidadId) } : {}),
          ...(contactoId ? { contacto_id: Number(contactoId) } : {}),
        }}
        lockedOportunidadId={lockedOportunidadId}
      />
    </Create>
  );
};
