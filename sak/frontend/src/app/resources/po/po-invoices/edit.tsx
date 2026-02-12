"use client";

import { Edit } from "@/components/edit";
import { useEditContext } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/date-field";
import { cn } from "@/lib/utils";
import { PoInvoiceForm } from "./form";
import { getInvoiceStatusBadgeClass, normalizePoInvoicePayload } from "./model";

const PoInvoiceEditTitle = () => {
  const { record } = useEditContext();
  if (!record) return "Editar Factura OC";
  const status = record.invoice_status?.nombre ?? "Borrador";
  const formattedId = String(record.id ?? "").padStart(6, "0");
  const numero = record.numero ? String(record.numero) : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar Factura OC</span>
      <Badge variant="outline" className="text-[11px]">
        #{formattedId}
      </Badge>
      {numero ? (
        <Badge variant="outline" className="text-[11px]">
          Nro: {numero}
        </Badge>
      ) : null}
      <Badge
        variant="secondary"
        className={cn("text-[11px]", getInvoiceStatusBadgeClass(status))}
      >
        {status}
      </Badge>
      <Badge variant="outline" className="text-[11px]">
        Fecha: <DateField source="created_at" record={record} />
      </Badge>
    </div>
  );
};

export const PoInvoiceEdit = () => (
  <Edit
    redirect="list"
    title={<PoInvoiceEditTitle />}
    actions={false}
    transform={(data: any) => normalizePoInvoicePayload(data)}
  >
    <PoInvoiceForm />
  </Edit>
);
