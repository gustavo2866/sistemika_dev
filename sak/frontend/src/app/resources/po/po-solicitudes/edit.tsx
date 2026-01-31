"use client";

import { Edit } from "@/components/edit";
import { useEditContext } from "ra-core";
import type { PoSolicitud } from "./model";
import { PoSolicitudForm } from "./form";

const PoSolicitudEditTitle = () => "Editar Solicitud";

const PoSolicitudEditActions = () => {
  const { record } = useEditContext<PoSolicitud & { id: number }>();
  const idLabel =
    record?.id != null ? `#${String(record.id).padStart(5, "0")}` : "";

  return (
    <div className="flex items-center gap-2">
      {idLabel ? (
        <span className="text-sm font-medium leading-none text-foreground">
          {idLabel}
        </span>
      ) : null}
    </div>
  );
};

export const PoSolicitudEdit = () => {
  return (
    <Edit
      title={<PoSolicitudEditTitle />}
      actions={<PoSolicitudEditActions />}
      className="w-full max-w-lg"
      redirect={false}
    >
      <PoSolicitudForm />
    </Edit>
  );
};

