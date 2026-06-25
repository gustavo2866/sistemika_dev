"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { FormOrderDeleteButton } from "@/components/forms/form_order";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { CalendarDays, Circle, ClipboardCheck, Hash } from "lucide-react";
import { DateField } from "@/components/date-field";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TarjaForm } from "./form";
import {
  getEstadoTarjaBadgeClass,
  getEstadoTarjaLabel,
  normalizeTarjaPayload,
  type TarjaRecord,
} from "./model";

type TarjaEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const TarjaEditTitle = () => {
  const { record } = useEditContext<TarjaRecord>();
  if (!record) return "Editar tarja";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Editar tarja
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
            getEstadoTarjaBadgeClass(record.estado),
          )}
        >
          <Circle className="h-2 w-2 fill-current" />
          {getEstadoTarjaLabel(record.estado)}
        </Badge>
        <Badge variant="outline" className="h-6 gap-1.5 rounded-md border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-700 shadow-sm">
          <CalendarDays className="h-3 w-3 text-slate-500" />
          <DateField source="fechainicio" record={record} />
          <span>-</span>
          <DateField source="fechafinal" record={record} />
        </Badge>
      </div>
    </div>
  );
};

const TarjaEditActions = () => (
  <div className="flex justify-end">
    <FormOrderDeleteButton />
  </div>
);

export const TarjaEdit = ({
  embedded = false,
  id,
  redirect,
}: TarjaEditProps) => {
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
      title={<TarjaEditTitle />}
      className="max-w-5xl w-full"
      actions={<TarjaEditActions />}
      transform={normalizeTarjaPayload}
      showBreadcrumb={!embedded}
      showHeader={!embedded}
      mutationOptions={
        redirect
          ? undefined
          : {
              onSuccess: () => {
                navigate(returnTo || "/tarjas", { replace: true });
              },
            }
      }
    >
      <TarjaForm />
    </Edit>
  );
};
