"use client";

import { Edit, type EditProps as BaseEditProps } from "@/components/edit";
import { Badge } from "@/components/ui/badge";
import { useEditContext } from "ra-core";
import { Building2, CalendarDays, Circle, ClipboardList, Hash } from "lucide-react";
import { PedidoForm } from "./form";
import { PedidoStatusActions } from "./status-actions";
import { PedidoBackButton } from "./navigation-title";
import {
  getPedidoEstadoBadgeClass,
  normalizePedidoPayload,
  type ConstructoraPedidoRecord,
} from "./model";

type PedidoEditProps = {
  embedded?: boolean;
  id?: BaseEditProps["id"];
  redirect?: BaseEditProps["redirect"];
};

const getEstadoLabel = (estado?: string | null) =>
  String(estado ?? "borrador").replace(/^\w/, (char) => char.toUpperCase());

const formatPedidoDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

const PedidoEditTitle = () => {
  const { record } = useEditContext<ConstructoraPedidoRecord>();
  if (!record) return "Editar pedido";
  const fechaPedido = formatPedidoDate(record.created_at ?? record.fecha_confirmacion_agente);
  const contactoPedido = record.contacto?.nombre_completo;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <PedidoBackButton />
        <span className="inline-flex items-center gap-2 text-2xl font-bold leading-tight text-slate-950">
          <ClipboardList className="h-4 w-4" />
          Editar pedido
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
      <Badge variant="outline" className="h-8 gap-2 rounded-md border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm">
        <Hash className="h-3.5 w-3.5 text-slate-500" />
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <Badge
        variant="secondary"
        className={`h-8 gap-2 rounded-md px-4 text-[11px] font-medium shadow-sm ${getPedidoEstadoBadgeClass(record.estado)}`}
      >
        <Circle className="h-2 w-2 fill-current" />
        {getEstadoLabel(record.estado)}
      </Badge>
      {fechaPedido ? (
        <Badge variant="outline" className="h-8 gap-2 rounded-md border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 shadow-sm">
          <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
          {fechaPedido}
        </Badge>
      ) : null}
      {contactoPedido ? (
        <Badge variant="outline" className="h-8 max-w-[260px] gap-2 truncate rounded-md border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 shadow-sm">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          {contactoPedido}
        </Badge>
      ) : null}
      </div>
    </div>
  );
};

const PedidoEditActions = () => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <PedidoStatusActions />
  </div>
);

export const PedidoEdit = ({ embedded = false, id, redirect }: PedidoEditProps) => (
  <Edit
    id={id}
    redirect={redirect ?? (embedded ? false : "list")}
    mutationMode="pessimistic"
    title={<PedidoEditTitle />}
    className="max-w-6xl w-full"
    contentClassName="max-w-[920px] w-full"
    actions={<PedidoEditActions />}
    transform={normalizePedidoPayload}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <PedidoForm />
  </Edit>
);
