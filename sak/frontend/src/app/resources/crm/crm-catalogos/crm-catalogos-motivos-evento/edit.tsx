"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { CRMMotivoEventoForm } from "./form";
import {
  getMotivoEventoBadgeClass,
  getMotivoEventoEstadoLabel,
  normalizeMotivoEventoPayload,
  type CRMMotivoEventoRecord,
} from "./model";

//#region Componentes de edicion

type CRMMotivoEventoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de edicion.
const CRMMotivoEventoEditTitle = () => {
  const { record } = useEditContext<CRMMotivoEventoRecord>();
  if (!record) return "Editar motivo de evento CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar motivo de evento CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge
        variant="secondary"
        className={getMotivoEventoBadgeClass(record.activo)}
      >
        {getMotivoEventoEstadoLabel(record.activo)}
      </Badge>
    </div>
  );
};

// Renderiza las acciones principales disponibles en edicion.
const CRMMotivoEventoEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

// Renderiza la pantalla de edicion reutilizando el formulario del recurso.
export const CRMMotivoEventoEdit = ({
  embedded = false,
  id,
  redirect,
}: CRMMotivoEventoEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMMotivoEventoEditTitle />}
    className="max-w-2xl w-full"
    actions={<CRMMotivoEventoEditActions />}
    transform={normalizeMotivoEventoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMMotivoEventoForm />
  </Edit>
);

//#endregion Componentes de edicion
