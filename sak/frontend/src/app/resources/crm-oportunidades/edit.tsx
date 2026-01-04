"use client";

import { Edit } from "@/components/edit";
import { FormToolbar } from "@/components/simple-form";
import { SaveButton } from "@/components/form";
import { CancelButton } from "@/components/cancel-button";
import { CRMOportunidadForm } from "./form";
import { CRMOportunidadPanelForm } from "./form_panel";
import { useLocation, useNavigate } from "react-router";
import { normalizeOportunidadId } from "./model";

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
      {fromPanel ? (
        <CRMOportunidadPanelForm toolbar={toolbar} />
      ) : (
        <CRMOportunidadForm toolbar={toolbar} />
      )}
    </Edit>
  );
};
