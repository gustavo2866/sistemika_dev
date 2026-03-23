"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { ParteDiarioForm } from "./form";
import {
  getEstadoParteBadgeClass,
  getEstadoParteLabel,
  normalizeParteDiarioPayload,
  type ParteDiarioRecord,
} from "./model";

type ParteDiarioEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const ParteDiarioEditTitle = () => {
  const { record } = useEditContext<ParteDiarioRecord>();
  if (!record) return "Editar parte diario";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar parte diario</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge variant="secondary" className={getEstadoParteBadgeClass(record.estado)}>
        {getEstadoParteLabel(record.estado)}
      </Badge>
    </div>
  );
};

const ParteDiarioEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const ParteDiarioEdit = ({
  embedded = false,
  id,
  redirect,
}: ParteDiarioEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<ParteDiarioEditTitle />}
    className="max-w-5xl w-full"
    actions={<ParteDiarioEditActions />}
    transform={normalizeParteDiarioPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ParteDiarioForm />
  </Edit>
);
