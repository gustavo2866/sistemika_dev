"use client";

import { Edit } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { CRMOrigenLeadForm } from "./form";
import {
  getOrigenLeadBadgeClass,
  getOrigenLeadEstadoLabel,
  normalizeOrigenLeadPayload,
  type CRMOrigenLeadRecord,
} from "./model";

//#region Componentes de edicion

// Renderiza el titulo contextual de la pantalla de edicion.
const CRMOrigenLeadEditTitle = () => {
  const { record } = useEditContext<CRMOrigenLeadRecord>();
  if (!record) return "Editar origen de lead CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar origen de lead CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge
        variant="secondary"
        className={getOrigenLeadBadgeClass(record.activo)}
      >
        {getOrigenLeadEstadoLabel(record.activo)}
      </Badge>
    </div>
  );
};

// Renderiza las acciones principales disponibles en edicion.
const CRMOrigenLeadEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

// Renderiza la pantalla de edicion reutilizando el formulario del recurso.
export const CRMOrigenLeadEdit = () => (
  <Edit
    redirect="list"
    title={<CRMOrigenLeadEditTitle />}
    className="max-w-2xl w-full"
    actions={<CRMOrigenLeadEditActions />}
    transform={normalizeOrigenLeadPayload}
  >
    <CRMOrigenLeadForm />
  </Edit>
);

//#endregion Componentes de edicion
