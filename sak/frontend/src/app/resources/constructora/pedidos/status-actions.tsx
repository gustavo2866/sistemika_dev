"use client";

import { useState } from "react";
import { useNotify, useRecordContext, useRefresh } from "ra-core";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";

import { apiUrl } from "@/lib/dataProvider";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useRowActionDialog } from "@/components/forms/form_order";
import {
  isPedidoReadOnly,
  type ConstructoraPedidoRecord,
} from "./model";

export const PEDIDO_STATUS_CONFIRM_OVERLAY_CLASS =
  "pointer-events-none bg-transparent backdrop-blur-none";

export const patchPedidoEstado = async (id: string | number, estado: string) => {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${apiUrl}/constructora/pedidos/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ estado }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "No se pudo actualizar el pedido");
  }
};

export type PedidoEstadoAction = "confirmar" | "cancelar";

export const PEDIDO_ESTADO_ACTIONS: Record<
  PedidoEstadoAction,
  {
    estado: "confirmado" | "cancelado";
    label: string;
    title: string;
    content: string;
    confirmColor: "primary" | "warning";
    icon: typeof CheckCircle2;
  }
> = {
  confirmar: {
    estado: "confirmado",
    label: "Confirmar",
    title: "Confirmar pedido",
    content: "Seguro que deseas confirmar este pedido?",
    confirmColor: "primary",
    icon: CheckCircle2,
  },
  cancelar: {
    estado: "cancelado",
    label: "Cancelar",
    title: "Cancelar pedido",
    content: "Seguro que deseas cancelar este pedido?",
    confirmColor: "warning",
    icon: XCircle,
  },
};

const canRunPedidoEstadoAction = (
  record: ConstructoraPedidoRecord | undefined,
  action: PedidoEstadoAction,
) => {
  if (!record?.id || isPedidoReadOnly(record.estado)) return false;
  return String(record.estado ?? "").trim().toLowerCase() !== PEDIDO_ESTADO_ACTIONS[action].estado;
};

export const PedidoEstadoMenuItems = ({
  disabled = false,
  onRequestAction,
}: {
  disabled?: boolean;
  onRequestAction?: (action: PedidoEstadoAction) => void;
}) => {
  const record = useRecordContext<ConstructoraPedidoRecord>();
  const notify = useNotify();
  const refresh = useRefresh();
  const dialog = useRowActionDialog();
  const [pendingAction, setPendingAction] = useState<PedidoEstadoAction | null>(null);
  const [loading, setLoading] = useState(false);

  const runAction = async (action: PedidoEstadoAction) => {
    if (!record?.id) return;
    setLoading(true);
    try {
      await patchPedidoEstado(record.id, PEDIDO_ESTADO_ACTIONS[action].estado);
      notify("Pedido actualizado", { type: "success" });
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo actualizar el pedido", {
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const openConfirm = (action: PedidoEstadoAction) => {
    if (onRequestAction) {
      onRequestAction(action);
      return;
    }
    const config = PEDIDO_ESTADO_ACTIONS[action];
    if (dialog) {
      dialog.openDialog({
        title: config.title,
        content: config.content,
        confirmLabel: config.label,
        confirmColor: config.confirmColor,
        modal: false,
        overlayClassName: PEDIDO_STATUS_CONFIRM_OVERLAY_CLASS,
        onConfirm: () => runAction(action),
      });
      return;
    }
    setPendingAction(action);
  };

  const visibleActions = (Object.keys(PEDIDO_ESTADO_ACTIONS) as PedidoEstadoAction[])
    .filter((action) => canRunPedidoEstadoAction(record, action));

  if (!visibleActions.length) return null;

  const pendingConfig = pendingAction ? PEDIDO_ESTADO_ACTIONS[pendingAction] : null;

  return (
    <>
      {visibleActions.map((action) => {
        const config = PEDIDO_ESTADO_ACTIONS[action];
        const Icon = config.icon;
        return (
          <DropdownMenuItem
            key={action}
            onSelect={(event) => {
              event.stopPropagation();
              if (onRequestAction) return;
              event.preventDefault();
              if (disabled || loading) return;
              openConfirm(action);
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (!onRequestAction || disabled || loading) return;
              onRequestAction(action);
            }}
            disabled={disabled || loading}
            variant={config.confirmColor === "warning" ? "destructive" : undefined}
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <Icon className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            {config.label}
          </DropdownMenuItem>
        );
      })}
      {pendingConfig ? (
        <Confirm
          isOpen={Boolean(pendingAction)}
          onClose={() => setPendingAction(null)}
          onConfirm={async () => {
            if (!pendingAction) return;
            await runAction(pendingAction);
            setPendingAction(null);
          }}
          title={pendingConfig.title}
          content={pendingConfig.content}
          confirm={pendingConfig.label}
          confirmColor={pendingConfig.confirmColor}
          modal={false}
          overlayClassName={PEDIDO_STATUS_CONFIRM_OVERLAY_CLASS}
          loading={loading}
        />
      ) : null}
    </>
  );
};

export const PedidoStatusActions = ({ className }: { className?: string }) => {
  const record = useRecordContext<ConstructoraPedidoRecord>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState<string | null>(null);

  if (!record?.id || isPedidoReadOnly(record.estado)) return null;

  const updateEstado = async (estado: string) => {
    setLoading(estado);
    try {
      await patchPedidoEstado(record.id, estado);
      notify("Pedido actualizado", { type: "success" });
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo actualizar el pedido", { type: "error" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)}>
      {record.estado !== "pendiente" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={loading !== null}
          onClick={() => updateEstado("pendiente")}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Pendiente
        </Button>
      ) : null}
    </div>
  );
};
