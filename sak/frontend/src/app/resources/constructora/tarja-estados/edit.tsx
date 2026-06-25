"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { TarjaEstadoForm } from "./form";
import {
  normalizeTarjaEstadoPayload,
  type TarjaEstado,
} from "./model";

type TarjaEstadoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const TarjaEstadoEditTitle = () => {
  const { record } = useEditContext<TarjaEstado>();
  if (!record) return "Editar estado de tarja";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar estado de tarja</span>
      <Badge variant="outline" className="text-[11px]">
        {record.abreviatura}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activo ? "Activo" : "Inactivo"}
      </Badge>
    </div>
  );
};

const TarjaEstadoEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const TarjaEstadoEdit = ({
  embedded = false,
  id,
  redirect,
}: TarjaEstadoEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<TarjaEstadoEditTitle />}
    className="max-w-2xl w-full"
    mutationMode="pessimistic"
    transform={(data: any) => normalizeTarjaEstadoPayload(data)}
    actions={<TarjaEstadoEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <TarjaEstadoForm />
  </Edit>
);
