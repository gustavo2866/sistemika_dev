"use client";

import { Edit } from "@/components/edit";
import { DeleteButton } from "@/components/delete-button";
import { ShowButton } from "@/components/show-button";
import { IconButtonWithTooltip } from "@/components/icon-button-with-tooltip";
import { useEditContext, useResourceDefinition } from "ra-core";
import type { PoFactura } from "./model";
import { PoFacturaForm } from "./form";
import { FileText } from "lucide-react";

const PoFacturaEditTitle = () => "Editar Factura";

const PoFacturaEditActions = () => {
  const { record } = useEditContext<PoFactura>();
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
      <IconButtonWithTooltip label="Ver PDF">
        <FileText className="h-4 w-4" />
      </IconButtonWithTooltip>
      {hasShow ? <ShowButton /> : null}
      <DeleteButton />
    </div>
  );
};

export const PoFacturaEdit = () => (
  <Edit
    title={<PoFacturaEditTitle />}
    actions={<PoFacturaEditActions />}
    className="w-full max-w-lg"
  >
    <PoFacturaForm />
  </Edit>
);
