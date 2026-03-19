"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { PoInvoiceStatusForm } from "./form";

type PoInvoiceStatusCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const PoInvoiceStatusCreateTitle = () => (
  <div className="flex flex-wrap items-center gap-2">
    <span>Crear estado de factura</span>
    <Badge variant="secondary" className="text-[11px]">
      Activo
    </Badge>
  </div>
);

export const PoInvoiceStatusCreate = ({
  embedded = false,
  redirect,
}: PoInvoiceStatusCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<PoInvoiceStatusCreateTitle />}
    className="max-w-2xl w-full"
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <PoInvoiceStatusForm />
  </Create>
);
