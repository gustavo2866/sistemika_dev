"use client";

import { Edit } from "@/components/edit";
import type { SetupEditComponentProps } from "@/components/forms/form_order";
import { useRecordContext } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ResourceTitle } from "@/components/resource-title";
import { ContratoForm } from "./form";
import { CONTRATO_ESTADO_BADGES, getContratoEstadoLabel, type Contrato } from "./model";

const ContratoEditTitle = () => {
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

export const ContratoEdit = ({
  embedded = false,
  id,
  redirect,
}: SetupEditComponentProps) => {
  const navigate = useNavigate();
  return (
    <Edit
      id={id}
      title={<ContratoEditTitle />}
      actions={false}
      redirect={redirect ?? false}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={
        redirect
          ? undefined
          : {
              onSuccess: () => navigate("/contratos", { replace: true }),
            }
      }
    >
      <ContratoForm />
    </Edit>
  );
};
