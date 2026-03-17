"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { CRMMotivoPerdidaForm } from "./form";
import {
  getMotivoPerdidaBadgeClass,
  getMotivoPerdidaEstadoLabel,
  normalizeMotivoPerdidaPayload,
  type CRMMotivoPerdidaRecord,
} from "./model";

//#region Componentes de edicion

type CRMMotivoPerdidaEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de edicion.
const CRMMotivoPerdidaEditTitle = () => {
  const { record } = useEditContext<CRMMotivoPerdidaRecord>();
  if (!record) return "Editar motivo de perdida CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar motivo de perdida CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge
        variant="secondary"
        className={getMotivoPerdidaBadgeClass(record.activo)}
      >
        {getMotivoPerdidaEstadoLabel(record.activo)}
      </Badge>
    </div>
  );
};

// Renderiza las acciones principales disponibles en edicion.
const CRMMotivoPerdidaEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

// Renderiza la pantalla de edicion reutilizando el formulario del recurso.
export const CRMMotivoPerdidaEdit = ({
  embedded = false,
  id,
  redirect,
}: CRMMotivoPerdidaEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMMotivoPerdidaEditTitle />}
    className="max-w-2xl w-full"
    actions={<CRMMotivoPerdidaEditActions />}
    transform={normalizeMotivoPerdidaPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMMotivoPerdidaForm />
  </Edit>
);

//#endregion Componentes de edicion
