"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { NominaTareaForm } from "./form";
import {
  normalizeNominaTareaPayload,
  type NominaTarea,
} from "./model";

type NominaTareaEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const NominaTareaEditTitle = () => {
  const { record } = useEditContext<NominaTarea>();
  if (!record) return "Editar tarea de nomina";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar tarea de nomina</span>
      <Badge variant="outline" className="text-[11px]">
        {record.codigo}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activa ? "Activa" : "Inactiva"}
      </Badge>
    </div>
  );
};

const NominaTareaEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const NominaTareaEdit = ({
  embedded = false,
  id,
  redirect,
}: NominaTareaEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<NominaTareaEditTitle />}
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={(data: any) => normalizeNominaTareaPayload(data)}
    actions={<NominaTareaEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <NominaTareaForm />
  </Edit>
);
