"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { NominaCategoriaForm } from "./form";
import {
  normalizeNominaCategoriaPayload,
  type NominaCategoria,
} from "./model";

type NominaCategoriaEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const NominaCategoriaEditTitle = () => {
  const { record } = useEditContext<NominaCategoria>();
  if (!record) return "Editar categoria de nomina";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar categoria de nomina</span>
      <Badge variant="outline" className="text-[11px]">
        {record.codigo}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activa ? "Activa" : "Inactiva"}
      </Badge>
    </div>
  );
};

const NominaCategoriaEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const NominaCategoriaEdit = ({
  embedded = false,
  id,
  redirect,
}: NominaCategoriaEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<NominaCategoriaEditTitle />}
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={(data: any) => normalizeNominaCategoriaPayload(data)}
    actions={<NominaCategoriaEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <NominaCategoriaForm />
  </Edit>
);
