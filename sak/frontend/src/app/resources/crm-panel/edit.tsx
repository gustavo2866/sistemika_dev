"use client";

import { Target } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Edit } from "@/components/edit";
import { ResourceTitle } from "@/components/resource-title";
import { FormToolbar } from "@/components/simple-form";
import { SaveButton } from "@/components/form";
import { CancelButton } from "@/components/cancel-button";
import { CRMOportunidadPanelForm } from "./form";

const normalizeId = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

export const CRMOportunidadPanelEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const redirect = returnTo ?? "/crm/panel";
  const toolbar = (
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
  );

  return (
    <Edit
      resource="crm/oportunidades"
      redirect={false}
      mutationMode="pessimistic"
      actions={false}
      transform={(data) => ({
        ...data,
        tipo_propiedad_id: normalizeId((data as any).tipo_propiedad_id),
        emprendimiento_id: normalizeId((data as any).emprendimiento_id),
      })}
      title={<ResourceTitle icon={Target} text="Editar Oportunidad" />}
    >
      <CRMOportunidadPanelForm toolbar={toolbar} />
    </Edit>
  );
};

export default CRMOportunidadPanelEdit;
