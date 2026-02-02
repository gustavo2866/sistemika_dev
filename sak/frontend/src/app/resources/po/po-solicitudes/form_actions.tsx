"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
  useResourceContext,
} from "ra-core";
import { CheckCircle2, Eye, MoreHorizontal, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HeaderSummaryDisplay } from "@/components/generic";
import { Confirm } from "@/components/confirm";
import { cn } from "@/lib/utils";
import { type PoSolicitud, ESTADO_BADGES, ESTADO_CHOICES } from "./model";

const PoSolicitudHeaderInline = () => {
  const { control } = useFormContext<PoSolicitud>();
  const estadoValue = useWatch({ control, name: "estado" });

  if (!estadoValue) return null;

  const estadoKey = String(estadoValue);
  const estadoLabel =
    ESTADO_CHOICES.find((choice) => choice.id === estadoKey)?.name || estadoValue;
  const badgeClass = ESTADO_BADGES[estadoKey] ?? "bg-muted text-muted-foreground";

  return (
    <HeaderSummaryDisplay
      fields={[
        {
          value: estadoLabel,
          formatter: (value) => (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none sm:text-[11px]",
                badgeClass
              )}
            >
              {String(value)}
            </span>
          ),
        },
      ]}
      layout="inline"
      className="flex w-full items-center justify-end"
    />
  );
};

export const FormActions = () => {
  const record = useRecordContext<PoSolicitud>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const resourceContext = useResourceContext();
  const resource = resourceContext ?? "po-solicitudes";
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "approve" | "reject" | "delete" | null
  >(null);

  if (!record) return null;

  const canApprove = record.estado === "emitida";
  const canReject = record.estado === "emitida";

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const handleStatusChange = async (estado: "aprobada" | "rechazada") => {
    if (!record?.id) {
      return;
    }
    setBusyAction(estado);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("auth_token");
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }
      const response = await fetch(`${apiBaseUrl}/po-solicitudes/${record.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ estado }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      notify(
        `Solicitud PO ${estado === "aprobada" ? "aprobada" : "rechazada"} correctamente`,
        { type: "info" }
      );
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la solicitud PO", { type: "warning" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!record?.id) return;
    setBusyAction("delete");
    try {
      await dataProvider.delete(resource, { id: record.id, previousData: record });
      notify("Solicitud PO eliminada", { type: "info" });
      redirect("list", resource);
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar la solicitud PO", { type: "warning" });
    } finally {
      setBusyAction(null);
    }
  };

  const openConfirm = (action: "approve" | "reject" | "delete") => {
    if (busyAction !== null) return;
    setConfirmAction(action);
  };

  const closeConfirm = () => setConfirmAction(null);

  const confirmTitle = {
    approve: "Aprobar solicitud",
    reject: "Rechazar solicitud",
    delete: "Eliminar solicitud",
  }[confirmAction ?? "approve"];

  const confirmContent = {
    approve: "Seguro que deseas aprobar la solicitud?",
    reject: "Seguro que deseas rechazar la solicitud?",
    delete: "Seguro que deseas eliminar la solicitud?",
  }[confirmAction ?? "approve"];

  const handleConfirm = () => {
    const action = confirmAction;
    closeConfirm();
    if (!action) return;
    if (action === "delete") {
      handleDelete();
      return;
    }
    handleStatusChange(action === "approve" ? "aprobada" : "rechazada");
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <PoSolicitudHeaderInline />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={busyAction !== null}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 sm:w-44 text-[10px] sm:text-xs">
            <DropdownMenuItem
              onClick={() => redirect("show", resource, record.id)}
              disabled={busyAction !== null}
            >
              <Eye className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Visualizar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => openConfirm("delete")}
              disabled={busyAction !== null}
              variant="destructive"
            >
              <Trash2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Eliminar
            </DropdownMenuItem>
            {canApprove || canReject ? (
              <>
                <DropdownMenuSeparator />
                {canApprove ? (
                  <DropdownMenuItem
                    onClick={() => openConfirm("approve")}
                    disabled={busyAction !== null}
                  >
                    <CheckCircle2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Aprobar
                  </DropdownMenuItem>
                ) : null}
                {canReject ? (
                  <DropdownMenuItem
                    onClick={() => openConfirm("reject")}
                    disabled={busyAction !== null}
                  >
                    <XCircle className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Rechazar
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Confirm
        isOpen={confirmAction !== null}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmTitle}
        content={confirmContent}
        confirmColor={confirmAction === "delete" ? "warning" : "primary"}
        loading={busyAction !== null}
      />
    </>
  );
};