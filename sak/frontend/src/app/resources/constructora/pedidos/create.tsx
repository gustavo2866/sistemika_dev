"use client";

import { Create, type CreateProps as BaseCreateProps } from "@/components/create";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Circle, ClipboardList } from "lucide-react";
import { PedidoForm } from "./form";
import { getPedidoEstadoBadgeClass, normalizePedidoPayload } from "./model";
import { PedidoBackButton } from "./navigation-title";

type PedidoCreateProps = {
  embedded?: boolean;
  redirect?: BaseCreateProps["redirect"];
};

const PedidoCreateTitle = () => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2">
      <PedidoBackButton />
      <span className="inline-flex items-center gap-2 text-2xl font-bold leading-tight text-slate-950">
        <ClipboardList className="h-4 w-4" />
        Crear pedido de obra
      </span>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Badge
        variant="secondary"
        className={`h-8 gap-2 rounded-md px-4 text-[11px] font-medium shadow-sm ${getPedidoEstadoBadgeClass("pendiente")}`}
      >
        <Circle className="h-2 w-2 fill-current" />
        Pendiente
      </Badge>
      <Badge variant="outline" className="h-8 gap-2 rounded-md border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 shadow-sm">
        <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
        {new Date().toLocaleDateString()}
      </Badge>
    </div>
  </div>
);

export const PedidoCreate = ({ embedded = false, redirect }: PedidoCreateProps) => (
  <Create
    redirect={redirect ?? (embedded ? false : "list")}
    title={<PedidoCreateTitle />}
    className="max-w-6xl w-full"
    contentClassName="max-w-[920px] w-full"
    transform={normalizePedidoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <PedidoForm />
  </Create>
);
