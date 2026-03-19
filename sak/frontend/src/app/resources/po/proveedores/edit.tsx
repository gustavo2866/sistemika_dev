"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { ProveedorForm } from "./form";
import type { Identifier } from "ra-core";

type ProveedorRecord = {
  id: Identifier;
  activo?: boolean;
};

type ProveedorEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const ProveedorEditTitle = () => {
  const { record } = useEditContext<ProveedorRecord>();
  if (!record) return "Editar proveedor";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar proveedor</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activo ? "Activo" : "Inactivo"}
      </Badge>
    </div>
  );
};

const ProveedorEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const ProveedorEdit = ({
  embedded = false,
  id,
  redirect,
}: ProveedorEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<ProveedorEditTitle />}
    className="max-w-2xl w-full"
    actions={<ProveedorEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ProveedorForm />
  </Edit>
);
