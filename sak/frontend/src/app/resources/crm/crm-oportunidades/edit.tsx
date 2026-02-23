"use client";

import { Edit } from "@/components/edit";
import { useEditContext } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/date-field";
import { cn } from "@/lib/utils";
import { CRMOportunidadPoForm } from "./form";
import {
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  formatEstadoOportunidad,
} from "@/app/resources/crm-oportunidades/model";
import { Target } from "lucide-react";

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

export const CRMOportunidadPoEdit = () => (
  <Edit redirect="list" title={<OportunidadEditTitle />} actions={false}>
    <CRMOportunidadPoForm />
  </Edit>
);

export default CRMOportunidadPoEdit;
