"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { TipoSolicitudForm } from "./form";
import type { TipoSolicitud } from "./model";

type TipoSolicitudEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const TipoSolicitudEditTitle = () => {
  const { record } = useEditContext<TipoSolicitud>();
  if (!record) return "Editar tipo de solicitud";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar tipo de solicitud</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activo ? "Activo" : "Inactivo"}
      </Badge>
    </div>
  );
};

const TipoSolicitudEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const TipoSolicitudEdit = ({
  embedded = false,
  id,
  redirect,
}: TipoSolicitudEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<TipoSolicitudEditTitle />}
    className="max-w-2xl w-full"
    actions={<TipoSolicitudEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <TipoSolicitudForm />
  </Edit>
);
