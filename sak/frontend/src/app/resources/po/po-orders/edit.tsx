"use client";

import { Edit } from "@/components/edit";
import { useEditContext } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/date-field";
import { cn } from "@/lib/utils";
import { PoOrderForm } from "./form";
import { getOrderStatusBadgeClass, normalizePoOrderPayload } from "./model";

const PoOrderEditTitle = () => {
  const { record } = useEditContext();
  if (!record) return "Editar Orden";
  const status = record.order_status?.nombre ?? "Borrador";
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
        Fecha: <DateField source="created_at" record={record} />
      </Badge>
    </div>
  );
};

export const PoOrderEdit = () => (
  <Edit
    redirect="list"
    title={<PoOrderEditTitle />}
    actions={false}
    transform={(data: any) => normalizePoOrderPayload(data)}
  >
    <PoOrderForm />
  </Edit>
);
