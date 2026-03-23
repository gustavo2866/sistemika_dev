"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { ProyectoForm } from "./form";
import {
  getProyectoEstadoBadgeClass,
  getProyectoEstadoLabel,
  normalizeProyectoPayload,
  type ProyectoRecord,
} from "./model";

type ProyectoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const ProyectoEditTitle = () => {
  const { record } = useEditContext<ProyectoRecord>();
  if (!record) return "Editar proyecto";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar proyecto</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge variant="secondary" className={getProyectoEstadoBadgeClass(record.estado)}>
        {getProyectoEstadoLabel(record.estado)}
      </Badge>
    </div>
  );
};

const ProyectoEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const ProyectoEdit = ({
  embedded = false,
  id,
  redirect,
}: ProyectoEditProps = {}) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    mutationMode="pessimistic"
    title={<ProyectoEditTitle />}
    className="max-w-5xl w-full"
    actions={<ProyectoEditActions />}
    transform={normalizeProyectoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ProyectoForm />
  </Edit>
);
