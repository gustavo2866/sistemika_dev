"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { CRMTipoOperacionForm } from "./form";
import {
  getTipoOperacionBadgeClass,
  getTipoOperacionEstadoLabel,
  normalizeTipoOperacionPayload,
  type CRMTipoOperacionRecord,
} from "./model";

//#region Componentes de edicion

type CRMTipoOperacionEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de edicion.
const CRMTipoOperacionEditTitle = () => {
  const { record } = useEditContext<CRMTipoOperacionRecord>();
  if (!record) return "Editar tipo de operacion CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar tipo de operacion CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge
        variant="secondary"
        className={getTipoOperacionBadgeClass(record.activo)}
      >
        {getTipoOperacionEstadoLabel(record.activo)}
      </Badge>
    </div>
  );
};

// Renderiza las acciones principales disponibles en edicion.
const CRMTipoOperacionEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

// Renderiza la pantalla de edicion reutilizando el formulario del recurso.
export const CRMTipoOperacionEdit = ({
  embedded = false,
  id,
  redirect,
}: CRMTipoOperacionEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMTipoOperacionEditTitle />}
    className="max-w-2xl w-full"
    actions={<CRMTipoOperacionEditActions />}
    transform={normalizeTipoOperacionPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMTipoOperacionForm />
  </Edit>
);

//#endregion Componentes de edicion
