"use client";

import { Edit } from "@/components/edit";
import { useEditContext } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PoOrderForm } from "./form";
import { FormOrderEditActions } from "@/components/forms";
import { computeDetalleImporte, computePoOrderTotal, getOrderStatusBadgeClass } from "./model";

const PoOrderEditTitle = () => {
  const { record } = useEditContext();
  if (!record) return "Editar Orden";
  const status = record.order_status?.nombre ?? "Borrador";
  const total = record.total ?? 0;
  const formattedId = String(record.id ?? "").padStart(6, "0");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Editar Orden</span>
      <Badge variant="outline" className="text-[11px]">
        #{formattedId}
      </Badge>
      <Badge variant="secondary" className={cn("text-[11px]", getOrderStatusBadgeClass(status))}>
        {status}
      </Badge>
      <Badge variant="outline" className="text-[11px]">
        Total: {total}
      </Badge>
    </div>
  );
};

export const PoOrderEdit = () => (
  <Edit
    redirect="list"
    title={<PoOrderEditTitle />}
    actions={<FormOrderEditActions />}
    transform={(data: any) => {
      const detalles = (data.detalles ?? []).map((d: any) => ({
        ...d,
        importe: computeDetalleImporte(d),
      }));
      return {
        ...data,
        detalles,
        total: computePoOrderTotal(detalles),
      };
    }}
  >
    <PoOrderForm />
  </Edit>
);
