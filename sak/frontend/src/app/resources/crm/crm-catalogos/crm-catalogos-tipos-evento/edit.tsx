"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { CRMTipoEventoForm } from "./form";
import {
  getTipoEventoBadgeClass,
  getTipoEventoEstadoLabel,
  normalizeTipoEventoPayload,
  type CRMTipoEventoRecord,
} from "./model";

//#region Componentes de edicion

type CRMTipoEventoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de edicion.
const CRMTipoEventoEditTitle = () => {
  const { record } = useEditContext<CRMTipoEventoRecord>();
  if (!record) return "Editar tipo de evento CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar tipo de evento CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge
        variant="secondary"
        className={getTipoEventoBadgeClass(record.activo)}
      >
        {getTipoEventoEstadoLabel(record.activo)}
      </Badge>
    </div>
  );
};

// Renderiza las acciones principales disponibles en edicion.
const CRMTipoEventoEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

// Renderiza la pantalla de edicion reutilizando el formulario del recurso.
export const CRMTipoEventoEdit = ({
  embedded = false,
  id,
  redirect,
}: CRMTipoEventoEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMTipoEventoEditTitle />}
    className="max-w-2xl w-full"
    actions={<CRMTipoEventoEditActions />}
    transform={normalizeTipoEventoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMTipoEventoForm />
  </Edit>
);

//#endregion Componentes de edicion
