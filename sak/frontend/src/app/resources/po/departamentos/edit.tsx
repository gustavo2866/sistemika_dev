"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { DepartamentoForm } from "./form";
import type { Identifier } from "ra-core";

type DepartamentoRecord = {
  id: Identifier;
  activo?: boolean;
};

type DepartamentoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const DepartamentoEditTitle = () => {
  const { record } = useEditContext<DepartamentoRecord>();
  if (!record) return "Editar departamento";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar departamento</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activo ? "Activo" : "Inactivo"}
      </Badge>
    </div>
  );
};

const DepartamentoEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const DepartamentoEdit = ({
  embedded = false,
  id,
  redirect,
}: DepartamentoEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<DepartamentoEditTitle />}
    className="max-w-2xl w-full"
    actions={<DepartamentoEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <DepartamentoForm />
  </Edit>
);
