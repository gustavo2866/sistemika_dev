"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { CRMCondicionPagoForm } from "./form";
import {
  getCondicionPagoBadgeClass,
  getCondicionPagoEstadoLabel,
  normalizeCondicionPagoPayload,
  type CRMCondicionPagoRecord,
} from "./model";

//#region Componentes de edicion

type CRMCondicionPagoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de edicion.
const CRMCondicionPagoEditTitle = () => {
  const { record } = useEditContext<CRMCondicionPagoRecord>();
  if (!record) return "Editar condicion de pago CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar condicion de pago CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge
        variant="secondary"
        className={getCondicionPagoBadgeClass(record.activo)}
      >
        {getCondicionPagoEstadoLabel(record.activo)}
      </Badge>
    </div>
  );
};

// Renderiza las acciones principales disponibles en edicion.
const CRMCondicionPagoEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

// Renderiza la pantalla de edicion reutilizando el formulario del recurso.
export const CRMCondicionPagoEdit = ({
  embedded = false,
  id,
  redirect,
}: CRMCondicionPagoEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMCondicionPagoEditTitle />}
    className="max-w-2xl w-full"
    actions={<CRMCondicionPagoEditActions />}
    transform={normalizeCondicionPagoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMCondicionPagoForm />
  </Edit>
);

//#endregion Componentes de edicion
