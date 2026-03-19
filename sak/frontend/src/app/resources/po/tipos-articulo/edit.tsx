"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { TipoArticuloForm } from "./form";
import type { Identifier } from "ra-core";

type TipoArticuloRecord = {
  id: Identifier;
  activo?: boolean;
};

type TipoArticuloEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const TipoArticuloEditTitle = () => {
  const { record } = useEditContext<TipoArticuloRecord>();
  if (!record) return "Editar tipo de articulo";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar tipo de articulo</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activo ? "Activo" : "Inactivo"}
      </Badge>
    </div>
  );
};

const TipoArticuloEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const TipoArticuloEdit = ({
  embedded = false,
  id,
  redirect,
}: TipoArticuloEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<TipoArticuloEditTitle />}
    className="max-w-2xl w-full"
    actions={<TipoArticuloEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <TipoArticuloForm />
  </Edit>
);
