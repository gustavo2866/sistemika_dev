"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";

import { CRMMensajeForm } from "./form";
import {
  formatMensajeEstado,
  formatMensajeTipo,
  getMensajeEstadoBadgeClass,
  getMensajeTipoBadgeClass,
  normalizeMensajePayload,
  type CRMMensajeRecord,
} from "./model";

//#region Componentes de edicion

type CRMMensajeEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

// Renderiza el titulo contextual de la pantalla de edicion.
const CRMMensajeEditTitle = () => {
  const { record } = useEditContext<CRMMensajeRecord>();
  if (!record) return "Editar mensaje CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar mensaje CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge variant="secondary" className={getMensajeTipoBadgeClass(record.tipo)}>
        {formatMensajeTipo(record.tipo)}
      </Badge>
      <Badge variant="secondary" className={getMensajeEstadoBadgeClass(record.estado)}>
        {formatMensajeEstado(record.estado)}
      </Badge>
    </div>
  );
};

// Renderiza las acciones principales disponibles en edicion.
const CRMMensajeEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

// Renderiza la pantalla de edicion reutilizando el formulario del recurso.
export const CRMMensajeEdit = ({
  embedded = false,
  id,
  redirect,
}: CRMMensajeEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMMensajeEditTitle />}
    className="max-w-3xl w-full"
    actions={<CRMMensajeEditActions />}
    transform={normalizeMensajePayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMMensajeForm />
  </Edit>
);

//#endregion Componentes de edicion
