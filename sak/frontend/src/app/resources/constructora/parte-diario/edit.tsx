"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { CalendarDays, Circle, Hash, NotebookPen } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { DateField } from "@/components/date-field";
import { cn } from "@/lib/utils";
import { ParteDiarioForm } from "./form";
import {
  getEstadoParteBadgeClass,
  getEstadoParteLabel,
  normalizeParteDiarioPayload,
  type ParteDiarioRecord,
} from "./model";

type ParteDiarioEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const ParteDiarioEditTitle = () => {
  const { record } = useEditContext<ParteDiarioRecord>();
  if (!record) return "Editar parte diario";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-2">
          <NotebookPen className="h-4 w-4" />
          Editar parte diario
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="h-6 gap-1.5 rounded-md border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 shadow-sm">
          <Hash className="h-3 w-3 text-slate-500" />
          #{String(record.id ?? "").padStart(6, "0")}
        </Badge>
        <Badge
          variant="secondary"
          className={cn(
            "h-6 gap-1.5 rounded-md px-2.5 text-[10px] font-medium shadow-sm",
            getEstadoParteBadgeClass(record.estado),
          )}
        >
          <Circle className="h-2 w-2 fill-current" />
          {getEstadoParteLabel(record.estado)}
        </Badge>
        <Badge variant="outline" className="h-6 gap-1.5 rounded-md border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-700 shadow-sm">
          <CalendarDays className="h-3 w-3 text-slate-500" />
          <DateField source="fecha" record={record} />
        </Badge>
      </div>
    </div>
  );
};

export const ParteDiarioEdit = ({
  embedded = false,
  id,
  redirect,
}: ParteDiarioEditProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const locationState = location.state as { returnTo?: string } | null;
  const returnTo = locationState?.returnTo ?? params.get("returnTo");

  return (
    <Edit
      id={id}
      redirect={redirect ?? false}
      mutationMode="pessimistic"
      title={<ParteDiarioEditTitle />}
      className="max-w-5xl w-full"
      actions={false}
      transform={normalizeParteDiarioPayload}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={
        redirect
          ? undefined
          : {
              onSuccess: () => {
                if (returnTo) {
                  navigate(returnTo, { replace: true });
                  return;
                }
                navigate("/parte-diario", { replace: true });
              },
            }
      }
    >
      <ParteDiarioForm returnTo={returnTo} />
    </Edit>
  );
};
