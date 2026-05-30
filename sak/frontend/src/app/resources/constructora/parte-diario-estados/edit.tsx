"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { ParteDiarioEstadoForm } from "./form";
import {
  normalizeParteDiarioEstadoPayload,
  type ParteDiarioEstado,
} from "./model";

type ParteDiarioEstadoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const ParteDiarioEstadoEditTitle = () => {
  const { record } = useEditContext<ParteDiarioEstado>();
  if (!record) return "Editar estado de parte diario";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar estado de parte diario</span>
      <Badge variant="outline" className="text-[11px]">
        {record.abreviatura}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activo ? "Activo" : "Inactivo"}
      </Badge>
    </div>
  );
};

const ParteDiarioEstadoEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const ParteDiarioEstadoEdit = ({
  embedded = false,
  id,
  redirect,
}: ParteDiarioEstadoEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<ParteDiarioEstadoEditTitle />}
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={(data: any) => normalizeParteDiarioEstadoPayload(data)}
    actions={<ParteDiarioEstadoEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ParteDiarioEstadoForm />
  </Edit>
);
