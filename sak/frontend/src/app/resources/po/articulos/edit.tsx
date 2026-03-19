"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { ArticuloForm } from "./form";
import type { Identifier } from "ra-core";

type ArticuloRecord = {
  id: Identifier;
  activo?: boolean;
};

type ArticuloEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const ArticuloEditTitle = () => {
  const { record } = useEditContext<ArticuloRecord>();
  if (!record) return "Editar articulo";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar articulo</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activo ? "Activo" : "Inactivo"}
      </Badge>
    </div>
  );
};

const ArticuloEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const ArticuloEdit = ({
  embedded = false,
  id,
  redirect,
}: ArticuloEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<ArticuloEditTitle />}
    className="max-w-2xl w-full"
    actions={<ArticuloEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ArticuloForm />
  </Edit>
);
