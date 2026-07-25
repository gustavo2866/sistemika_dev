"use client";

import { CalendarDays, Circle, GitBranch, Hash } from "lucide-react";
import { useEditContext } from "ra-core";

import { DateField } from "@/components/date-field";
import { Edit } from "@/components/edit";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ErpRubroForm } from "./form";
import { normalizeErpRubroPayload, type ErpRubro } from "./model";

type ErpRubroEditProps = {
  embedded?: boolean;
  id?: string | number;
  redirect?: string | false;
};

const activoBadgeClass = (activo?: boolean | string | number | null) =>
  activo === false || activo === "false" || activo === 0 || activo === "0"
    ? "bg-zinc-100 text-zinc-800"
    : "bg-emerald-100 text-emerald-800";

const ErpRubroEditTitle = () => {
  const { record } = useEditContext<ErpRubro>();
  if (!record) return "Editar rubro ERP";

  const activoLabel =
    record.activo === false || record.activo === "false" || record.activo === 0 || record.activo === "0"
      ? "Inactivo"
      : "Activo";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 text-2xl font-bold leading-tight text-slate-950">
          <GitBranch className="h-4 w-4" />
          Editar rubro ERP
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="h-8 gap-2 rounded-md border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm">
          <Hash className="h-3.5 w-3.5 text-slate-500" />
          #{String(record.id ?? "").padStart(6, "0")}
        </Badge>
        <Badge
          variant="secondary"
          className={cn(
            "h-8 gap-2 rounded-md px-4 text-[11px] font-medium shadow-sm",
            activoBadgeClass(record.activo),
          )}
        >
          <Circle className="h-2 w-2 fill-current" />
          {activoLabel}
        </Badge>
        {record.created_at ? (
          <Badge variant="outline" className="h-8 gap-2 rounded-md border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 shadow-sm">
            <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
            <DateField source="created_at" record={record} />
          </Badge>
        ) : null}
      </div>
    </div>
  );
};

export const ErpRubroEdit = ({
  embedded = false,
  id,
  redirect = "list",
}: ErpRubroEditProps) => (
  <Edit
    id={id}
    redirect={redirect}
    mutationMode="pessimistic"
    title={<ErpRubroEditTitle />}
    className="max-w-6xl w-full"
    contentClassName="max-w-[920px] w-full"
    transform={normalizeErpRubroPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ErpRubroForm />
  </Edit>
);
