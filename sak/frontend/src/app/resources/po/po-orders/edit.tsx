"use client";

import { Edit } from "@/components/edit";
import { useEditContext, useGetOne } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/date-field";
import { cn } from "@/lib/utils";
import { PoOrderForm } from "./form";
import { getOrderStatusBadgeClass, normalizePoOrderPayload } from "./model";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, CalendarDays, Circle, ClipboardList, Hash } from "lucide-react";
import { PoOrderBackButton } from "./navigation-title";

const PoOrderEditTitle = () => {
  const { record } = useEditContext();
  const oportunidadId = Number(record?.oportunidad_id ?? 0);
  const { data: oportunidad } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadId },
    { enabled: Boolean(oportunidadId) },
  );
  if (!record) return "Editar Orden";
  const status = record.order_status?.nombre ?? "Borrador";
  const formattedId = String(record.id ?? "").padStart(6, "0");
  const oportunidadLabel =
    (oportunidad as { titulo?: string; descripcion_estado?: string } | undefined)?.titulo ??
    (oportunidad as { descripcion_estado?: string } | undefined)?.descripcion_estado;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <PoOrderBackButton />
        <span className="inline-flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          <span>Editar Orden</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="h-8 gap-2 rounded-md border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm">
          <Hash className="h-3.5 w-3.5 text-slate-500" />
          #{formattedId}
        </Badge>
        <Badge
          variant="secondary"
          className={cn(
            "h-8 gap-2 rounded-md px-4 text-[11px] font-medium shadow-sm",
            getOrderStatusBadgeClass(status),
          )}
        >
          <Circle className="h-2 w-2 fill-current" />
          {status}
        </Badge>
        <Badge variant="outline" className="h-8 gap-2 rounded-md border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 shadow-sm">
          <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
          <DateField source="created_at" record={record} />
        </Badge>
        {oportunidadLabel ? (
          <Badge variant="outline" className="h-8 max-w-[280px] gap-2 truncate rounded-md border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 shadow-sm">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate">proyecto: {oportunidadLabel}</span>
          </Badge>
        ) : null}
      </div>
    </div>
  );
};

export const PoOrderEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const locationState = location.state as { returnTo?: string } | null;
  const returnTo = locationState?.returnTo ?? params.get("returnTo");

  return (
    <Edit
      redirect={false}
      mutationMode="pessimistic"
      title={<PoOrderEditTitle />}
      actions={false}
      transform={(data: any) => normalizePoOrderPayload(data)}
      mutationOptions={{
        onSuccess: () => {
          if (returnTo) {
            navigate(returnTo, { replace: true });
            return;
          }
          navigate("/po-orders", { replace: true });
        },
      }}
    >
      <PoOrderForm />
    </Edit>
  );
};
