"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { PoOrderStatusForm } from "./form";
import type { Identifier } from "ra-core";

type PoOrderStatusRecord = {
  id: Identifier;
  activo?: boolean;
};

type PoOrderStatusEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const PoOrderStatusEditTitle = () => {
  const { record } = useEditContext<PoOrderStatusRecord>();
  if (!record) return "Editar estado de orden";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar estado de orden</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activo ? "Activo" : "Inactivo"}
      </Badge>
    </div>
  );
};

const PoOrderStatusEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const PoOrderStatusEdit = ({
  embedded = false,
  id,
  redirect,
}: PoOrderStatusEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<PoOrderStatusEditTitle />}
    className="max-w-2xl w-full"
    actions={<PoOrderStatusEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <PoOrderStatusForm />
  </Edit>
);
