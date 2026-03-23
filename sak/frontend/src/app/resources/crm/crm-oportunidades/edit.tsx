"use client";

import { Edit } from "@/components/edit";
import { useEditContext } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/date-field";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  formatEstadoOportunidad,
} from "./model";
import { Target } from "lucide-react";
import { CRMOportunidadForm } from "./form";

const OportunidadEditTitle = () => {
  const { record } = useEditContext();
  if (!record) return "Editar Oportunidad";
  const estado = record.estado ?? "Sin estado";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-2">
        <Target className="h-4 w-4" />
        <span>Editar Oportunidad</span>
      </span>
      <Badge variant="outline" className="text-[11px]">
        #{record.id}
      </Badge>
      <Badge
        variant="secondary"
        className={cn("text-[11px]", CRM_OPORTUNIDAD_ESTADO_BADGES[estado as keyof typeof CRM_OPORTUNIDAD_ESTADO_BADGES] || "bg-slate-100 text-slate-800")}
      >
        {formatEstadoOportunidad(estado)}
      </Badge>
      <Badge variant="outline" className="text-[11px]">
        Fecha: <DateField source="fecha_estado" record={record} />
      </Badge>
    </div>
  );
};

export const CRMOportunidadEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { returnTo?: string } | null;
  const returnTo = locationState?.returnTo;

  return (
    <Edit
      redirect={false}
      mutationMode="pessimistic"
      title={<OportunidadEditTitle />}
      actions={false}
      mutationOptions={{
        onSuccess: () => {
          navigate(returnTo ?? "/crm/oportunidades", {
            replace: true,
          });
        },
      }}
    >
      <CRMOportunidadForm />
    </Edit>
  );
};

export default CRMOportunidadEdit;
