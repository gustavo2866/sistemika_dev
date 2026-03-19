"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { PoInvoiceStatusFinForm } from "./form";
import type { Identifier } from "ra-core";

type PoInvoiceStatusFinRecord = {
  id: Identifier;
  activo?: boolean;
};

type PoInvoiceStatusFinEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const PoInvoiceStatusFinEditTitle = () => {
  const { record } = useEditContext<PoInvoiceStatusFinRecord>();
  if (!record) return "Editar estado financiero de factura";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar estado financiero de factura</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge variant="secondary" className="text-[11px]">
        {record.activo ? "Activo" : "Inactivo"}
      </Badge>
    </div>
  );
};

const PoInvoiceStatusFinEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const PoInvoiceStatusFinEdit = ({
  embedded = false,
  id,
  redirect,
}: PoInvoiceStatusFinEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    title={<PoInvoiceStatusFinEditTitle />}
    className="max-w-2xl w-full"
    actions={<PoInvoiceStatusFinEditActions />}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <PoInvoiceStatusFinForm />
  </Edit>
);
