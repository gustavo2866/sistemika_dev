"use client";

import { Edit } from "@/components/edit";
import { FormToolbar } from "@/components/simple-form";
import { SaveButton } from "@/components/form";
import { CancelButton } from "@/components/cancel-button";
import { CRMOportunidadForm } from "./form";
import { useLocation, useNavigate } from "react-router";
import { normalizeOportunidadId } from "./model";
import { IconButtonWithTooltip } from "@/components/icon-button-with-tooltip";
import { Calendar, FileText } from "lucide-react";
import { useRecordContext } from "ra-core";
import { ShowButton } from "@/components/show-button";
import { DeleteButton } from "@/components/delete-button";
import type { CRMOportunidad } from "./model";

const OportunidadHeaderActions = ({
  returnTo,
}: {
  returnTo?: string;
}) => {
  const record = useRecordContext<CRMOportunidad>();
  const navigate = useNavigate();

  if (!record?.id) {
    return (
      <div className="flex items-center gap-2">
        <ShowButton />
        <DeleteButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <IconButtonWithTooltip
        label="Eventos"
        onClick={() => {
          const filterParam = encodeURIComponent(
            JSON.stringify({ oportunidad_id: record.id })
          );
          navigate(`/crm/eventos?filter=${filterParam}`, {
            state: {
              fromOportunidad: true,
              oportunidad_id: record.id,
              returnTo: returnTo ?? `/crm/oportunidades/${record.id}`,
              filter: { oportunidad_id: record.id },
            },
          });
        }}
      >
        <Calendar className="h-4 w-4" />
      </IconButtonWithTooltip>
      <IconButtonWithTooltip
        label="Solicitudes"
        onClick={() => {
          const filterParam = encodeURIComponent(
            JSON.stringify({ oportunidad_id: record.id })
          );
          navigate(`/solicitudes?filter=${filterParam}`, {
            state: {
              oportunidad_id: record.id,
              returnTo: returnTo ?? `/crm/oportunidades/${record.id}`,
              filter: { oportunidad_id: record.id },
            },
          });
        }}
      >
        <FileText className="h-4 w-4" />
      </IconButtonWithTooltip>
      <ShowButton />
      <DeleteButton />
    </div>
  );
};

export const CRMOportunidadEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const fromPanel = Boolean((location.state as { fromPanel?: boolean } | null)?.fromPanel);
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const redirect = returnTo ?? (fromPanel ? "/crm/panel" : "list");
  const useCustomToolbar = Boolean(returnTo) || fromPanel;
  const toolbar = useCustomToolbar ? (
    <FormToolbar className="mt-3 rounded-2xl border border-border/50 bg-background/80 p-2 shadow-sm sm:mt-4 sm:p-3">
      <div className="flex justify-end gap-2">
        <CancelButton className="h-8 px-3 text-xs" onClick={() => navigate(redirect)} />
        <SaveButton
          type="button"
          className="h-8 px-3 text-xs"
          mutationOptions={{ onSuccess: () => navigate(redirect) }}
        />
      </div>
    </FormToolbar>
  ) : undefined;

  return (
    <Edit
      redirect={useCustomToolbar ? false : "list"}
      mutationMode="pessimistic"
      actions={<OportunidadHeaderActions returnTo={returnTo ?? (fromPanel ? "/crm/panel" : undefined)} />}
      transform={
        fromPanel
          ? (data) => ({
              ...data,
              tipo_propiedad_id: normalizeOportunidadId((data as any).tipo_propiedad_id),
              emprendimiento_id: normalizeOportunidadId((data as any).emprendimiento_id),
            })
          : undefined
      }
    >
      <CRMOportunidadForm toolbar={toolbar} />
    </Edit>
  );
};
