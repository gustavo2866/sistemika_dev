"use client";

import { Edit } from "@/components/edit";
import { useEditContext } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/date-field";
import { cn } from "@/lib/utils";
import { PoInvoiceForm } from "./form";
import {
  getInvoiceStatusBadgeClass,
  getInvoiceStatusFinBadgeClass,
  normalizePoInvoicePayload,
} from "./model";

// Titulo del formulario de edicion de Factura OC.
const PoInvoiceEditTitle = () => {
  const { record } = useEditContext();
  if (!record) return "Editar Factura OC";
  const status = record.invoice_status?.nombre ?? "Borrador";
  const statusFin = record.invoice_status_fin?.nombre ?? "";
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
      {statusFin ? (
        <Badge
          variant="secondary"
          className={cn("text-[11px]", getInvoiceStatusFinBadgeClass(statusFin))}
        >
          Agenda: {statusFin}
        </Badge>
      ) : null}
      <Badge variant="outline" className="text-[11px]">
        Fecha: <DateField source="created_at" record={record} />
      </Badge>
    </div>
  );
};

// Wrapper de edit para Factura OC.
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
