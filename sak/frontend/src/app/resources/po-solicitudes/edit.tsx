"use client";

import { Edit } from "@/components/edit";
import { DeleteButton } from "@/components/delete-button";
import { ShowButton } from "@/components/show-button";
import { useEditContext, useResourceDefinition } from "ra-core";
import type { PoSolicitud } from "./model";
import { PoSolicitudForm } from "./form";

const PoSolicitudEditTitle = () => "Editar Solicitud";

const PoSolicitudEditActions = () => {
  const { record } = useEditContext<PoSolicitud>();
  const { hasShow } = useResourceDefinition();
  const idLabel =
    record?.id != null ? `#${String(record.id).padStart(5, "0")}` : "";

  return (
    <div className="flex items-center gap-2">
      {idLabel ? (
        <span className="text-sm font-medium leading-none text-foreground">
          {idLabel}
        </span>
      ) : null}
      {hasShow ? <ShowButton /> : null}
      <DeleteButton />
    </div>
  );
};

export const PoSolicitudEdit = () => (
  <Edit
    title={<PoSolicitudEditTitle />}
    actions={<PoSolicitudEditActions />}
    className="w-full max-w-lg"
  >
    <PoSolicitudForm />
  </Edit>
);

