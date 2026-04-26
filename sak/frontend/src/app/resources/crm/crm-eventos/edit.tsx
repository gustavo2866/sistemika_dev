"use client";

import { Edit } from "@/components/edit";
import { CRMEventoForm, CRMEventoFormTitle } from "./form";
import { CalendarCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { getOportunidadIdFromLocation } from "@/lib/oportunidad-context";

export const CRMEventoEdit = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const lockedOportunidadId = useMemo(
    () => getOportunidadIdFromLocation(location),
    [location]
  );

  return (
    <Edit
      title={<CRMEventoFormTitle icon={CalendarCheck} text="Editar Evento CRM" />}
      redirect={false}
      actions={false}
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
