"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { CRMTipoContactoForm } from "./form";
import {
  getTipoContactoBadgeClass,
  getTipoContactoEstadoLabel,
  normalizeTipoContactoPayload,
  type CRMTipoContactoRecord,
} from "./model";

//#region Componentes de edicion

type CRMTipoContactoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const CRMTipoContactoEditTitle = () => {
  const { record } = useEditContext<CRMTipoContactoRecord>();
  if (!record) return "Editar tipo de contacto CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar tipo de contacto CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge
        variant="secondary"
        className={getTipoContactoBadgeClass(record.activo)}
      >
        {getTipoContactoEstadoLabel(record.activo)}
      </Badge>
    </div>
  );
};

const CRMTipoContactoEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const CRMTipoContactoEdit = ({
  embedded = false,
  id,
  redirect,
}: CRMTipoContactoEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<CRMTipoContactoEditTitle />}
    className="max-w-2xl w-full"
    actions={<CRMTipoContactoEditActions />}
    transform={normalizeTipoContactoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <CRMTipoContactoForm />
  </Edit>
);

//#endregion Componentes de edicion
