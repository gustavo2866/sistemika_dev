"use client";

import { useRecordContext } from "ra-core";
import { FileText } from "lucide-react";

import { Show } from "@/components/show";
import { ResourceTitle } from "@/components/resource-title";
import { Badge } from "@/components/ui/badge";

import { ContratoForm } from "./form";
import { CONTRATO_ESTADO_BADGES, getContratoEstadoLabel, type Contrato } from "./model";

const ContratoShowTitle = () => {
  const record = useRecordContext<Contrato>();
  const estado = record?.estado ?? "borrador";
  const badgeClass = CONTRATO_ESTADO_BADGES[estado] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <ResourceTitle icon={FileText} text={`Contrato #${record?.id ?? ""}`} />
      <Badge variant="outline" className={`text-[11px] ${badgeClass}`}>
        {getContratoEstadoLabel(estado)}
      </Badge>
    </div>
  );
};

export const ContratoShow = () => (
  <Show title={<ContratoShowTitle />}>
    <ContratoForm readOnly />
  </Show>
);
