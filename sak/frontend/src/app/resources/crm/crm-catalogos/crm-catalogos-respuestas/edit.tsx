"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { CRMCatalogoRespuestaForm } from "./form";
import {
  getCatalogoRespuestaBadgeClass,
  getCatalogoRespuestaEstadoLabel,
  normalizeCatalogoRespuestaPayload,
  type CRMCatalogoRespuestaRecord,
} from "./model";

//#region Componentes de edicion

type CRMCatalogoRespuestaEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de edicion.
const CRMCatalogoRespuestaEditTitle = () => {
  const { record } = useEditContext<CRMCatalogoRespuestaRecord>();
  if (!record) return "Editar respuesta CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar respuesta CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge
        variant="secondary"
        className={getCatalogoRespuestaBadgeClass(record.activo)}
      >
        {getCatalogoRespuestaEstadoLabel(record.activo)}
      </Badge>
    </div>
  );
};

// Renderiza las acciones principales disponibles en edicion.
const CRMCatalogoRespuestaEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

// Renderiza la pantalla de edicion reutilizando el formulario del recurso.
export const CRMCatalogoRespuestaEdit = ({
  embedded = false,
  id,
  redirect,
}: CRMCatalogoRespuestaEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMCatalogoRespuestaEditTitle />}
    className="max-w-2xl w-full"
    actions={<CRMCatalogoRespuestaEditActions />}
    transform={normalizeCatalogoRespuestaPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMCatalogoRespuestaForm />
  </Edit>
);

//#endregion Componentes de edicion
