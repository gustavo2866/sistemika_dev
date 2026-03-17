"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { CRMCelularForm } from "./form";
import {
  getCelularBadgeClass,
  getCelularEstadoLabel,
  normalizeCelularPayload,
  type CRMCelularRecord,
} from "./model";

//#region Componentes de edicion

type CRMCelularEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de edicion.
const CRMCelularEditTitle = () => {
  const { record } = useEditContext<CRMCelularRecord>();
  if (!record) return "Editar celular CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar celular CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge
        variant="secondary"
        className={getCelularBadgeClass(record.activo)}
      >
        {getCelularEstadoLabel(record.activo)}
      </Badge>
    </div>
  );
};

// Renderiza las acciones principales disponibles en edicion.
const CRMCelularEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

// Renderiza la pantalla de edicion reutilizando el formulario del recurso.
export const CRMCelularEdit = ({
  embedded = false,
  id,
  redirect,
}: CRMCelularEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMCelularEditTitle />}
    className="max-w-2xl w-full"
    actions={<CRMCelularEditActions />}
    transform={normalizeCelularPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMCelularForm />
  </Edit>
);

//#endregion Componentes de edicion
