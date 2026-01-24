"use client";

import { Edit } from "@/components/edit";
import { CRMEventoForm } from "./form";
import { ResourceTitle } from "@/components/resource-title";
import { CalendarCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";

export const CRMEventoEdit = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const lockedOportunidadId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const rawFilter = params.get("filter");
    if (rawFilter) {
      try {
        const parsed = JSON.parse(rawFilter);
        if (parsed?.oportunidad_id != null) {
          const numeric = Number(parsed.oportunidad_id);
          return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
        }
      } catch {
        // ignore invalid filter param
      }
    }
    const direct = params.get("oportunidad_id");
    if (direct != null) {
      const numeric = Number(direct);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
    }
    return undefined;
  }, [location.search]);

  return (
    <Edit
      title={<ResourceTitle icon={CalendarCheck} text="Editar Evento CRM" />}
      redirect={false}
      mutationOptions={{
        onSuccess: () => {
          navigate(-1);
        },
      }}
    >
      <CRMEventoForm lockedOportunidadId={lockedOportunidadId} />
    </Edit>
  );
};
