"use client";

import { Target } from "lucide-react";
import { Edit } from "@/components/edit";
import { ResourceTitle } from "@/components/resource-title";
import { CRMOportunidadPanelForm } from "./form";

const normalizeId = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

export const CRMOportunidadPanelEdit = () => (
  <Edit
    resource="crm/oportunidades"
    redirect="/crm/panel"
    mutationMode="pessimistic"
    transform={(data) => ({
      ...data,
      tipo_propiedad_id: normalizeId((data as any).tipo_propiedad_id),
      emprendimiento_id: normalizeId((data as any).emprendimiento_id),
    })}
    title={<ResourceTitle icon={Target} text="Editar Oportunidad" />}
  >
    <CRMOportunidadPanelForm />
  </Edit>
);

export default CRMOportunidadPanelEdit;
